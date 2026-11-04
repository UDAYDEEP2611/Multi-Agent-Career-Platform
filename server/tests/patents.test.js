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
let patentId;

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

const base = (id = patentId) => `/api/patents/${id}`;

test("patents require sign-in", async () => {
  await request(app).get("/api/patents").expect(401);
});

test("patents can be created, listed, updated and validated", async () => {
  const created = await agentA.post("/api/patents").send({
    title: "  Method for Sorting ",
    patentNumber: " US 1234567 ",
    status: "Issued",
    date: "2023-05-02",
    coInventors: ["Alex Lee", " alex  lee "],
    url: "https://example.com/patent"
  }).expect(201);

  patentId = created.body.patent._id;
  assert.equal(created.body.patent.title, "Method for Sorting");
  assert.equal(created.body.patent.patentNumber, "US 1234567");
  assert.deepEqual(created.body.patent.coInventors, ["Alex Lee"]);

  await agentA.post("/api/patents").send({
    title: "Pending Idea", patentNumber: "US 2024/0001", status: "Pending", date: "2024-01-10"
  }).expect(201);

  const list = await agentA.get("/api/patents").expect(200);
  assert.deepEqual(list.body.patents.map((item) => item.title), ["Pending Idea", "Method for Sorting"]);

  const nextYear = new Date().getFullYear() + 1;
  const valid = { title: "X", patentNumber: "US 1" };
  const invalid = [
    [{ patentNumber: "US 1" }, /title is required/],
    [{ title: "X" }, /number is required/],
    [{ ...valid, patentNumber: "x".repeat(61) }, /at most 60/],
    [{ ...valid, title: "x".repeat(256) }, /at most 255/],
    [{ ...valid, status: "Granted" }, /Issued or Pending/],
    [{ ...valid, date: `${nextYear}-01-01` }, /future/],
    [{ ...valid, coInventors: Array(21).fill("A") }, /up to 20 other inventors/],
    [{ ...valid, url: "ftp://example.com" }, /http/],
    [{ ...valid, description: "x".repeat(2001) }, /at most 2000/],
    [{ ...valid, userId: "x" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/patents").send(body).expect(400);
    assert.match(response.body.message, message);
  }

  const updated = await agentA.patch(base()).send({ status: "Pending" }).expect(200);
  assert.equal(updated.body.patent.status, "Pending");
  assert.equal(updated.body.patent.patentNumber, "US 1234567");
});

test("other users cannot change or delete a patent", async () => {
  await agentB.patch(base()).send({ title: "Taken" }).expect(404);
  await agentB.delete(base()).expect(404);
  assert.equal((await agentB.get("/api/patents").expect(200)).body.patents.length, 0);

  await agentA.delete(base()).expect(200);
  await agentA.delete(base()).expect(404);
});
