const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
// No model and no A2A agent: the agents run on their rules
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9";
process.env.A2A_DESIGNER_URL = "off";

const password = "a-long-test-password";
let mongoServer;
let agent;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  const app = require("../app")({ sessionStore: new session.MemoryStore() });
  await request(app).post("/api/auth/register").send({ username: "undo_owner", email: "undo_owner@example.com", password, confirmPassword: password }).expect(201);
  agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "undo_owner", password }).expect(200);
  await agent.post("/api/projects").send({ title: "Blood Bank Management System" }).expect(201);
  await agent.post("/api/skills").send({ name: "Docker", rating: 4 }).expect(201);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const resumeChat = async (message) => (await agent.post("/api/resume-chat/navy").send({ message }).expect(200)).body;
const settings = async () => (await agent.get("/api/resume-settings").expect(200)).body.settings;
const undo = (changeId) => agent.post("/api/agent-changes/undo").send({ changeId });

test("one message's changes to a resume are undone together", async () => {
  const body = await resumeChat("make it navy and only 1 project");
  assert.equal(body.changed, true, body.reply);
  assert.ok(body.changeId);
  let navy = (await settings()).designs.navy;
  assert.equal(navy.limits.projects, 1);
  assert.match(navy.accent, /^#/);

  const undone = (await undo(body.changeId).expect(200)).body;
  assert.match(undone.message, /Undid/);
  // As before: this resume had no changes of its own
  assert.equal((await settings()).designs.navy, undefined);
  // Already undone
  await undo(body.changeId).expect(409);
});

test("an entry switched off everywhere comes back", async () => {
  const body = await resumeChat("hide Docker from every resume");
  assert.ok(body.changeId, body.reply);
  const docker = async () => (await agent.get("/api/skills").expect(200)).body.skills.find((skill) => skill.name === "Docker");
  assert.equal((await docker()).showInResume, false);
  await undo(body.changeId).expect(200);
  assert.equal((await docker()).showInResume, true);
});

test("only the latest change can be undone, so nothing later is lost", async () => {
  const first = await resumeChat("only 1 project");
  const second = await resumeChat("add interests");
  await undo(first.changeId).expect(409);
  await undo(second.changeId).expect(200);
  // Now the first is the latest
  await undo(first.changeId).expect(200);
  assert.equal((await settings()).designs.navy, undefined, "both undone, in order");
});

test("a question changes nothing, so there's nothing to undo", async () => {
  const body = await resumeChat("what's on this resume?");
  assert.equal(body.changeId, "");
  await agent.post("/api/agent-changes/undo").send({}).expect(400);
});

test("the assistant's design changes are undone, and the chat shows it", async () => {
  const say = async (text) => (await agent.post("/api/chat/message").send({ text }).expect(200)).body;
  let body = await say("Make a dark green Slate called Forest");
  const made = body.messages[1];
  assert.ok(made.changeId, made.text);
  const designs = async () => (await agent.get("/api/custom-designs").expect(200)).body.designs;
  const forest = (await designs())[0];
  assert.equal(forest.name, "Forest");

  body = await say("use rounded corners on Forest");
  const changed = body.messages[1];
  assert.equal((await designs())[0].corners, "round", changed.text);
  await undo(changed.changeId).expect(200);
  assert.equal((await designs())[0].corners, forest.corners, "the design is as it was");

  await undo(made.changeId).expect(200);
  assert.equal((await designs()).length, 0, "the made design is gone");
  const thread = (await agent.get("/api/chat").expect(200)).body.messages;
  assert.equal(thread.find((message) => message.changeId === made.changeId).undone, true);
});
