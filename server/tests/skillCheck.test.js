const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
delete process.env.ANTHROPIC_API_KEY;

let mongoServer;
let app;
let agent;
const realFetch = global.fetch;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  const SkillCatalog = require("../models/SkillCatalog");
  await SkillCatalog.syncIndexes();
  await SkillCatalog.create([
    { name: "JavaScript", skillType: "technical" },
    { name: "Communication", skillType: "soft" }
  ]);

  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });
  agent = request.agent(app);

  await agent
    .post("/__test/login")
    .send({ userId: new mongoose.Types.ObjectId().toString() })
    .expect(200);

  for (const name of ["React.js", "Python", "C#"]) {
    await agent.post("/api/skills").send({ name }).expect(201);
  }
});

afterEach(() => {
  global.fetch = realFetch;
  delete process.env.ANTHROPIC_API_KEY;
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

const check = (name) => agent.post("/api/skills/check").send({ name }).expect(200);

test("finds the same skill, look-alikes and spelling fixes without AI", async () => {
  const same = await check("  python ");
  assert.equal(same.body.existing.name, "Python");

  const reactjs = await check("ReactJS");
  assert.equal(reactjs.body.existing, null);
  assert.deepEqual(reactjs.body.similar.map((skill) => skill.name), ["React.js"]);

  const typo = await check("Pyhton");
  assert.deepEqual(typo.body.similar.map((skill) => skill.name), ["Python"]);

  const casing = await check("javascript");
  assert.equal(casing.body.suggestion, "JavaScript");
  assert.equal(casing.body.checkedBy, "rules");

  const soft = await check("Comunication");
  assert.equal(soft.body.suggestion, "Communication");
  assert.equal(soft.body.skillType, "soft");

  // Short names must match exactly: "C" is not "C#"
  const c = await check("C");
  assert.deepEqual(c.body.similar, []);
  assert.equal(c.body.suggestion, null);

  await agent.post("/api/skills/check").send({ name: "" }).expect(400);
});

test("uses Claude when an API key is set, and ignores made-up matches", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  global.fetch = async (url, options) => {
    assert.match(url, /api\.anthropic\.com/);
    assert.equal(options.headers["x-api-key"], "test-key");

    return {
      ok: true,
      json: async () => ({
        content: [{
          type: "text",
          text: '{"correctedName": "Kubernetes", "skillType": "technical", "sameAs": ["Python", "Not A Skill"]}'
        }]
      })
    };
  };

  const response = await check("Kubernets");
  assert.equal(response.body.checkedBy, "ai");
  assert.equal(response.body.suggestion, "Kubernetes");
  assert.deepEqual(response.body.similar.map((skill) => skill.name), ["Python"]);
});

test("falls back to rules when the AI call fails", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  global.fetch = async () => ({ ok: false, status: 500 });

  const response = await check("Pyhton");
  assert.equal(response.body.checkedBy, "rules");
  assert.deepEqual(response.body.similar.map((skill) => skill.name), ["Python"]);
});
