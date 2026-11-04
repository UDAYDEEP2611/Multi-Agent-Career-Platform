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
let experienceA;
let experienceB;
let recommendationId;

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

  const experience = (agent) =>
    agent.post("/api/experiences").send({
      jobTitle: "Engineer",
      organization: "Example Co",
      startYear: 2022,
      currentlyWorking: true
    }).expect(201);

  experienceA = (await experience(agentA)).body.experience._id;
  experienceB = (await experience(agentB)).body.experience._id;
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

const base = (id = recommendationId) => `/api/recommendations/${id}`;

test("recommendations require sign-in", async () => {
  await request(app).get("/api/recommendations").expect(401);
});

test("recommendations and references can be created, listed and updated", async () => {
  const created = await agentA.post("/api/recommendations").send({
    firstName: "  Alex ",
    lastName: "Lee",
    relationship: "Manager",
    recommenderTitle: "Engineering Manager",
    recommenderOrganization: "Example Co",
    contextType: "experience",
    contextId: experienceA,
    text: "A dependable engineer.",
    month: 1,
    year: 2024,
    profileUrl: "https://example.com/alex"
  }).expect(201);

  recommendationId = created.body.recommendation._id;
  assert.equal(created.body.recommendation.firstName, "Alex");

  // References may skip the text
  await agentA.post("/api/recommendations").send({
    kind: "Reference",
    firstName: "Sam",
    relationship: "Colleague",
    email: "sam@example.com",
    phone: "+1 (555) 010-0100",
    featured: true
  }).expect(201);

  const list = await agentA.get("/api/recommendations").expect(200);
  assert.deepEqual(list.body.recommendations.map((item) => item.firstName), ["Sam", "Alex"]);

  const updated = await agentA.patch(base()).send({ relationship: "Mentor", contextType: null }).expect(200);
  assert.equal(updated.body.recommendation.relationship, "Mentor");
  assert.equal(updated.body.recommendation.contextId, null);
  assert.equal(updated.body.recommendation.text, "A dependable engineer.");
});

test("recommendations are validated", async () => {
  const nextYear = new Date().getFullYear() + 1;
  const valid = { firstName: "X", relationship: "Colleague", text: "Great." };
  const invalid = [
    [{ relationship: "Colleague", text: "Hi" }, /First name is required/],
    [{ firstName: "X", text: "Hi" }, /Relationship is required/],
    [{ firstName: "X", relationship: "Colleague" }, /text is required/],
    [{ ...valid, text: "x".repeat(3001) }, /at most 3000/],
    [{ ...valid, kind: "Letter" }, /Recommendation or Reference/],
    [{ ...valid, year: nextYear }, /future/],
    [{ ...valid, month: 3 }, /Year is required/],
    [{ ...valid, email: "not-an-email" }, /valid email/],
    [{ ...valid, phone: "call me" }, /Phone/],
    [{ ...valid, profileUrl: "javascript:alert(1)" }, /http/],
    // Another user's experience can't be used
    [{ ...valid, contextType: "experience", contextId: experienceB }, /your experiences/],
    [{ ...valid, userId: "x" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/recommendations").send(body).expect(400);
    assert.match(response.body.message, message);
  }
});

test("other users cannot change or delete a recommendation", async () => {
  await agentB.patch(base()).send({ firstName: "Taken" }).expect(404);
  await agentB.delete(base()).expect(404);
  assert.equal((await agentB.get("/api/recommendations").expect(200)).body.recommendations.length, 0);

  await agentA.delete(base()).expect(200);
  await agentA.delete(base()).expect(404);
});
