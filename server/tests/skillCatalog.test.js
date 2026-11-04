const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";

let mongoServer;
let app;
let agent;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  const SkillCatalog = require("../models/SkillCatalog");
  const { seedSkillCatalog } = require("../scripts/seedSkillCatalog");

  await SkillCatalog.syncIndexes();
  await seedSkillCatalog();

  app = createApp({
    enableTestAuth: true,
    sessionStore: new session.MemoryStore()
  });

  agent = request.agent(app);
  await agent
    .post("/__test/login")
    .send({ userId: new mongoose.Types.ObjectId().toString() })
    .expect(200);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

const search = async (q) =>
  (await agent.get("/api/skill-catalog/search").query({ q }).expect(200))
    .body.suggestions.map((skill) => skill.name);

test("catalog search requires sign-in", async () => {
  await request(app).get("/api/skill-catalog/search?q=py").expect(401);
});

test("catalog search returns prefix matches first, case-insensitively", async () => {
  const names = await search("  PY ");
  assert.ok(names.length > 0 && names.length <= 10);
  assert.ok(names.includes("Python"));
  assert.ok(names.includes("PyTorch"));
  assert.ok(names.every((name) => name.toLowerCase().startsWith("py")));
});

test("catalog search also matches later words", async () => {
  const names = await search("spark");
  assert.deepEqual(names, ["Apache Spark"]);
  // Names starting with the word come first, then later-word matches
  assert.deepEqual(await search("lead"), ["Leadership", "Technical Leadership"]);
});

test("catalog search handles empty and special-character queries", async () => {
  assert.deepEqual(await search(""), []);
  assert.deepEqual(await search("c++"), ["C++"]);
  assert.deepEqual(await search(".*"), []);
  await agent.get("/api/skill-catalog/search").query({ q: "x".repeat(101) }).expect(400);
  await agent.get("/api/skill-catalog/search?q=a&q=b").expect(400);
});

test("seeding twice adds nothing new", async () => {
  const { seedSkillCatalog } = require("../scripts/seedSkillCatalog");
  const result = await seedSkillCatalog();
  assert.equal(result.upsertedCount, 0);
});
