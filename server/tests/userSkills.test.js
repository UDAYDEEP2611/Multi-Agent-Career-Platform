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

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");

  app = createApp({
    enableTestAuth: true,
    sessionStore: new session.MemoryStore()
  });

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

test("unauthenticated users cannot access skills", async () => {
  await request(app).get("/api/skills").expect(401);
});

test("skills can be created, listed in order, updated and deleted", async () => {
  await agentA.post("/api/skills").send({
    name: "Python", rating: 5, lastUsedYear: 2025, skillType: "technical", isImportant: true
  }).expect(201);

  await agentA.post("/api/skills").send({
    name: "Leadership", rating: 4, lastUsedYear: 2025, skillType: "soft"
  }).expect(201);

  const sql = await agentA.post("/api/skills").send({
    name: "SQL", rating: 4, lastUsedYear: 2020
  }).expect(201);

  const list = await agentA.get("/api/skills").expect(200);
  assert.equal(list.body.total, 3);
  assert.equal(list.body.importantCount, 1);
  // Grouped like the Skills tabs: Important, Technical, Soft
  assert.deepEqual(list.body.skills.map((s) => s.name), ["Python", "SQL", "Leadership"]);

  const id = sql.body.skill._id;
  const updated = await agentA.patch(`/api/skills/${id}`)
    .send({ rating: 5, lastUsedYear: 2024, name: "PostgreSQL" })
    .expect(200);
  assert.equal(updated.body.skill.rating, 5);
  assert.equal(updated.body.skill.name, "PostgreSQL");
  assert.equal(updated.body.skill.normalizedName, "postgresql");

  // Other users can't see or change it
  await agentB.patch(`/api/skills/${id}`).send({ rating: 1 }).expect(404);
  await agentB.delete(`/api/skills/${id}`).expect(404);
  assert.equal((await agentB.get("/api/skills")).body.total, 0);

  await agentA.delete(`/api/skills/${id}`).expect(200);
  assert.equal((await agentA.get("/api/skills")).body.total, 2);
});

test("skills reject invalid input and duplicates", async () => {
  const dup = await agentA.post("/api/skills").send({ name: "  python " }).expect(409);
  assert.match(dup.body.message, /already exists/);

  // Renaming onto an existing name is also a duplicate
  const other = await agentA.post("/api/skills").send({ name: "Go", rating: 3 }).expect(201);
  await agentA.patch(`/api/skills/${other.body.skill._id}`).send({ name: "PYTHON" }).expect(409);

  await agentA.post("/api/skills").send({ name: "Rust", rating: 6 }).expect(400);
  await agentA.post("/api/skills").send({ name: "Rust", rating: 0 }).expect(400);
  await agentA.post("/api/skills").send({ name: "Rust", rating: 2, isImportant: true }).expect(400);
  await agentA.post("/api/skills").send({ name: "Rust", lastUsedYear: new Date().getFullYear() + 1 }).expect(400);
  await agentA.post("/api/skills").send({ name: "Rust", skillType: "other" }).expect(400);
  await agentA.post("/api/skills").send({ name: "Rust", userId: "x" }).expect(400);
});

test("at most 50 skills can be important, rated 3/5 or higher", async () => {
  for (let i = 0; i < 49; i++) {
    await agentB.post("/api/skills").send({ name: `Top ${i}`, rating: 3 + (i % 3), isImportant: true }).expect(201);
  }

  await agentB.post("/api/skills").send({ name: "Top 49", rating: 5, isImportant: true }).expect(201);
  await agentB.post("/api/skills").send({ name: "Top 50", rating: 5, isImportant: true }).expect(409);

  const normal = await agentB.post("/api/skills").send({ name: "Normal", rating: 5 }).expect(201);
  await agentB.patch(`/api/skills/${normal.body.skill._id}`).send({ isImportant: true }).expect(409);
});

test("important skills keep the order they were marked in, and can be reordered", async () => {
  const agent = request.agent(app);
  await agent.post("/__test/login").send({ userId: new mongoose.Types.ObjectId().toString() }).expect(200);

  const add = async (name, isImportant) =>
    (await agent.post("/api/skills").send({ name, rating: 5, isImportant }).expect(201)).body.skill._id;

  const first = await add("First", true);
  const second = await add("Second", true);
  const later = await add("Later", false);
  await agent.patch(`/api/skills/${later}`).send({ isImportant: true }).expect(200);

  const importantNames = async () =>
    (await agent.get("/api/skills")).body.skills
      .filter((skill) => skill.isImportant)
      .map((skill) => skill.name);

  assert.deepEqual(await importantNames(), ["First", "Second", "Later"]);

  await agent.put("/api/skills/order").send({ group: "important", skillIds: [later, first, second] }).expect(200);
  assert.deepEqual(await importantNames(), ["Later", "First", "Second"]);

  // A newly marked skill goes last
  await add("Newest", true);
  assert.deepEqual(await importantNames(), ["Later", "First", "Second", "Newest"]);

  // The list must be exactly the important skills
  await agent.put("/api/skills/order").send({ group: "important", skillIds: [later, first] }).expect(409);
  await agent.put("/api/skills/order").send({ group: "important", skillIds: [later, later] }).expect(400);
  await agent.put("/api/skills/order").send({ group: "important", skillIds: "x" }).expect(400);
  await agentB.put("/api/skills/order").send({ group: "important", skillIds: [later] }).expect(409);
});

test("technical and soft skills sort by level until reordered", async () => {
  const agent = request.agent(app);
  await agent.post("/__test/login").send({ userId: new mongoose.Types.ObjectId().toString() }).expect(200);

  const add = async (name, rating, skillType = "technical") =>
    (await agent.post("/api/skills").send({ name, rating, skillType }).expect(201)).body.skill._id;

  const low = await add("Low", 2);
  const high = await add("High", 5);
  const mid = await add("Mid", 3);
  const talk = await add("Talking", 4, "soft");

  const names = async (type) =>
    (await agent.get("/api/skills")).body.skills
      .filter((skill) => !skill.isImportant && skill.skillType === type)
      .map((skill) => skill.name);

  assert.deepEqual(await names("technical"), ["High", "Mid", "Low"]);

  await agent.put("/api/skills/order").send({ group: "technical", skillIds: [low, mid, high] }).expect(200);
  assert.deepEqual(await names("technical"), ["Low", "Mid", "High"]);

  // New unplaced skills follow the placed ones
  await add("Newer", 5);
  assert.deepEqual(await names("technical"), ["Low", "Mid", "High", "Newer"]);

  // Groups are checked separately
  await agent.put("/api/skills/order").send({ group: "soft", skillIds: [talk] }).expect(200);
  await agent.put("/api/skills/order").send({ group: "soft", skillIds: [low] }).expect(409);
  await agent.put("/api/skills/order").send({ group: "other", skillIds: [low] }).expect(400);

  // Moving to another group drops the old position
  await agent.patch(`/api/skills/${low}`).send({ skillType: "soft" }).expect(200);
  assert.deepEqual(await names("soft"), ["Talking", "Low"]);
  assert.deepEqual(await names("technical"), ["Mid", "High", "Newer"]);
});
