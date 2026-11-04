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
let agentA;
let agentB;
let interestId;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });

  agentA = request.agent(app);
  agentB = request.agent(app);

  for (const agent of [agentA, agentB]) {
    await agent
      .post("/__test/login")
      .send({ userId: new mongoose.Types.ObjectId().toString() })
      .expect(200);
  }
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

const base = (id = interestId) => `/api/interests/${id}`;

test("interests require sign-in", async () => {
  await request(app).get("/api/interests").expect(401);
});

test("interests can be created, listed, updated and validated", async () => {
  const created = await agentA.post("/api/interests").send({
    name: "  Rock   Climbing ",
    category: "Sports & Fitness",
    description: "Weekend bouldering."
  }).expect(201);

  interestId = created.body.interest._id;
  assert.equal(created.body.interest.name, "Rock Climbing");

  // Same name in any case is a duplicate
  const duplicate = await agentA.post("/api/interests").send({ name: "rock climbing" }).expect(409);
  assert.match(duplicate.body.message, /already added/);

  // Another user can add the same name
  await agentB.post("/api/interests").send({ name: "Rock Climbing" }).expect(201);

  await agentA.post("/api/interests").send({ name: "Chess" }).expect(201);
  const list = await agentA.get("/api/interests").expect(200);
  assert.deepEqual(list.body.interests.map((item) => item.name), ["Rock Climbing", "Chess"]);
  assert.equal(list.body.interests[1].category, "Other");

  const invalid = [
    [{}, /1–60/],
    [{ name: "x".repeat(61) }, /1–60/],
    [{ name: "X", category: "Napping" }, /Invalid category/],
    [{ name: "X", description: "x".repeat(301) }, /300/],
    [{ name: "X", userId: "x" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/interests").send(body).expect(400);
    assert.match(response.body.message, message);
  }

  const updated = await agentA.patch(base()).send({ category: "Outdoors & Travel" }).expect(200);
  assert.equal(updated.body.interest.category, "Outdoors & Travel");
  assert.equal(updated.body.interest.name, "Rock Climbing");

  await agentA.patch(base()).send({ name: "CHESS" }).expect(409);
});

test("interests are limited to 30 and private to their owner", async () => {
  await agentB.patch(base()).send({ name: "Taken" }).expect(404);
  await agentB.delete(base()).expect(404);

  for (let index = 0; index < 28; index += 1) {
    await agentA.post("/api/interests").send({ name: `Interest ${index}` }).expect(201);
  }

  const full = await agentA.post("/api/interests").send({ name: "One more" }).expect(400);
  assert.match(full.body.message, /up to 30/);

  await agentA.delete(base()).expect(200);
  await agentA.delete(base()).expect(404);
});
