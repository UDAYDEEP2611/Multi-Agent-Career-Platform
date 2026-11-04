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
let publicationId;

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

const base = (id = publicationId) => `/api/publications/${id}`;

test("publications require sign-in", async () => {
  await request(app).get("/api/publications").expect(401);
});

test("publications can be created, listed, updated and validated", async () => {
  const created = await agentA.post("/api/publications").send({
    title: "  A Study of Feedback ",
    publisher: "Example Journal",
    publishedOn: "2024-02-29",
    coAuthors: [" Alex  Lee ", "Sam Park", "alex lee"],
    url: "https://example.com/paper",
    description: "Findings."
  }).expect(201);

  publicationId = created.body.publication._id;
  assert.equal(created.body.publication.title, "A Study of Feedback");
  // Trimmed, with duplicates removed
  assert.deepEqual(created.body.publication.coAuthors, ["Alex Lee", "Sam Park"]);

  await agentA.post("/api/publications").send({ title: "Undated" }).expect(201);
  await agentA.post("/api/publications").send({ title: "Older", publishedOn: "2019-06-01" }).expect(201);

  const list = await agentA.get("/api/publications").expect(200);
  assert.deepEqual(
    list.body.publications.map((item) => item.title),
    ["A Study of Feedback", "Older", "Undated"]
  );

  const nextYear = new Date().getFullYear() + 1;
  const invalid = [
    [{}, /Title is required/],
    [{ title: "x".repeat(256) }, /at most 255/],
    [{ title: "X", publisher: "x".repeat(256) }, /at most 255/],
    [{ title: "X", publishedOn: `${nextYear}-01-01` }, /future/],
    [{ title: "X", publishedOn: "2023-02-30" }, /real date/],
    [{ title: "X", publishedOn: "02/01/2023" }, /real date/],
    [{ title: "X", coAuthors: Array(21).fill("A") }, /up to 20/],
    [{ title: "X", coAuthors: [""] }, /1–100/],
    [{ title: "X", url: "javascript:alert(1)" }, /http/],
    [{ title: "X", description: "x".repeat(2001) }, /at most 2000/],
    [{ title: "X", userId: "x" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/publications").send(body).expect(400);
    assert.match(response.body.message, message);
  }

  const updated = await agentA.patch(base()).send({ publishedOn: null, coAuthors: [] }).expect(200);
  assert.equal(updated.body.publication.publishedOn, null);
  assert.deepEqual(updated.body.publication.coAuthors, []);
  assert.equal(updated.body.publication.publisher, "Example Journal");
});

test("other users cannot change or delete a publication", async () => {
  await agentB.patch(base()).send({ title: "Taken" }).expect(404);
  await agentB.delete(base()).expect(404);
  assert.equal((await agentB.get("/api/publications").expect(200)).body.publications.length, 0);

  await agentA.delete(base()).expect(200);
  await agentA.delete(base()).expect(404);
});
