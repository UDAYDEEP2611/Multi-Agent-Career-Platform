const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";

const password = "a-long-test-password";

let mongoServer;
let app;
let agent;
let userId;

async function registerAndSignIn(username) {
  const registered = await request(app).post("/api/auth/register").send({
    username, email: `${username}@example.com`, password, confirmPassword: password
  }).expect(201);

  const signedIn = request.agent(app);
  await signedIn.post("/api/auth/login").send({ identifier: username, password }).expect(200);

  return { id: registered.body.user.id, agent: signedIn };
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });

  ({ id: userId, agent } = await registerAndSignIn("log_owner"));
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("the activity log is locked until the password is entered", async () => {
  const locked = await agent.get("/api/account/activity").expect(423);
  assert.equal(locked.body.locked, true);
  assert.equal((await agent.get("/api/account/lock").expect(200)).body.unlocked, false);

  await agent.post("/api/account/unlock").send({ password: "wrong-password!!" }).expect(401);
  await agent.post("/api/account/unlock").send({ password: "" }).expect(400);

  const unlocked = await agent.post("/api/account/unlock").send({ password }).expect(200);
  assert.equal(unlocked.body.unlocked, true);
  await agent.get("/api/account/activity").expect(200);

  await agent.post("/api/account/lock").expect(200);
  await agent.get("/api/account/activity").expect(423);
});

test("creates, updates and deletes are recorded with readable names", async () => {
  const created = await agent.post("/api/experiences").send({
    jobTitle: "Data Engineer", organization: "Example Co", startYear: 2022, currentlyWorking: true
  }).expect(201);
  const id = created.body.experience._id;

  await agent.patch(`/api/experiences/${id}`).send({ jobTitle: "Senior Data Engineer" }).expect(200);
  await agent.post(`/api/experiences/${id}/tasks`).send({ description: "Built pipelines" }).expect(201);
  await agent.delete(`/api/experiences/${id}`).expect(200);

  // Failed changes and checks aren't recorded
  await agent.post("/api/interests").send({}).expect(400);
  await agent.post("/api/skills/check").send({ name: "Go" }).expect(200);

  await agent.post("/api/account/unlock").send({ password }).expect(200);

  // Entries are written just after each response; wait for all four
  let entries = [];
  for (let attempt = 0; attempt < 50 && entries.length < 4; attempt += 1) {
    ({ entries } = (await agent.get("/api/account/activity?kind=data").expect(200)).body);
    if (entries.length < 4) await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const summary = entries.map((entry) => `${entry.action} ${entry.section} ${entry.label}`.trim());
  assert.deepEqual(summary.sort(), [
    "created Experience Data Engineer",
    "created Experience › Tasks Built pipelines",
    "deleted Experience",
    "updated Experience Senior Data Engineer"
  ]);
});

test("sign-ins, failed attempts and unlocks are in the sign-in log", async () => {
  await request(app).post("/api/auth/login").send({ identifier: "log_owner", password: "wrong-password!!" }).expect(401);

  const { entries } = (await agent.get("/api/account/activity?kind=auth").expect(200)).body;
  const actions = entries.map((entry) => entry.action);

  for (const action of ["signed_in", "sign_in_failed", "unlock_failed", "unlocked"]) {
    assert.ok(actions.includes(action), `missing ${action}`);
  }
  assert.equal(actions.filter((action) => action === "unlock_failed").length, 1);
});

test("users see and end their own other sessions, and their storage", async () => {
  const sessions = mongoose.connection.db.collection("sessions");
  const future = new Date(Date.now() + 60 * 60 * 1000);
  await sessions.insertMany([
    { _id: "phone", expires: future, session: JSON.stringify({ userId, device: { userAgent: "Mobile Safari" } }) },
    { _id: "someone-else", expires: future, session: JSON.stringify({ userId: new mongoose.Types.ObjectId().toString() }) }
  ]);

  const list = await agent.get("/api/account/sessions").expect(200);
  assert.equal(list.body.sessions.length, 1);
  assert.equal(list.body.sessions[0].userAgent, "Mobile Safari");

  const ended = await agent.post("/api/account/sessions/sign-out-others").expect(200);
  assert.equal(ended.body.ended, 1);
  assert.equal(await sessions.countDocuments({ _id: "someone-else" }), 1, "other users untouched");

  const storage = await agent.get("/api/account/storage").expect(200);
  assert.equal(storage.body.limitBytes, 20 * 1024 * 1024);
  assert.ok(storage.body.database.collections.some((item) => item.name === "activity_log"));
});

test("logs are private, and unlock guesses are rate limited", async () => {
  const { agent: other } = await registerAndSignIn("other_owner");
  await other.post("/api/account/unlock").send({ password }).expect(200);

  const { entries } = (await other.get("/api/account/activity").expect(200)).body;
  assert.ok(entries.every((entry) => !entry.label.includes("Data Engineer")));

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await other.post("/api/account/unlock").send({ password: "nope-nope-nope" }).expect(401);
  }
  await other.post("/api/account/unlock").send({ password }).expect(429);
});
