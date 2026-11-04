const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "admin-console-uploads-"));

const pdfBuffer = Buffer.from("%PDF-1.4\n% integration test file\n%%EOF\n");
const password = "a-long-test-password";

let mongoServer;
let app;
let admin;
let member;
let adminAgent;
let memberAgent;

const sessions = () => mongoose.connection.db.collection("sessions");
const dbExists = async (name) =>
  (await mongoose.connection.db.admin().listDatabases({ nameOnly: true }))
    .databases.some((db) => db.name === name);

async function register(username) {
  const response = await request(app).post("/api/auth/register").send({
    username, email: `${username}@example.com`, password, confirmPassword: password
  }).expect(201);
  return response.body.user.id;
}

async function signIn(userId) {
  const agent = request.agent(app);
  await agent.post("/__test/login").send({ userId }).expect(200);
  return agent;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });

  admin = await register("console_admin");
  member = await register("console_member");
  await require("../scripts/makeAdmin").setAdmin("console_admin");

  adminAgent = await signIn(admin);
  memberAgent = await signIn(member);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test("every admin console route is admin-only", async () => {
  for (const [method, url] of [
    ["get", "/api/admin/overview"],
    ["get", "/api/admin/sessions"],
    ["get", "/api/admin/databases"],
    ["get", "/api/admin/system"],
    ["get", "/api/admin/storage"],
    ["get", "/api/admin/audit"],
    ["post", "/api/admin/system/clear-cache"],
    ["delete", `/api/admin/users/${admin}`]
  ]) {
    await memberAgent[method](url).expect(403);
  }
});

test("overview and system report counts, server and cache state", async () => {
  const overview = await adminAgent.get("/api/admin/overview").expect(200);
  assert.equal(overview.body.users.total, 2);
  assert.equal(overview.body.users.admins, 1);
  assert.equal(overview.body.databases.userDatabases, 1, "only the member; admins have none");

  const system = await adminAgent.get("/api/admin/system").expect(200);
  assert.equal(system.body.database.state, "connected");
  assert.ok(system.body.cache.preparedDatabases.length >= 1);

  const cleared = await adminAgent.post("/api/admin/system/clear-cache").expect(200);
  assert.ok(cleared.body.cleared >= 1);

  // The next request sets the user's database up again
  await memberAgent.get("/api/interests").expect(200);
});

test("storage shows space per database and collection against fixed limits", async () => {
  await memberAgent.post("/api/interests").send({ name: "Storage test" }).expect(201);

  const response = await adminAgent.get("/api/admin/storage").expect(200);
  assert.equal(response.body.limits.totalBytes, 200 * 1024 * 1024);
  assert.equal(response.body.limits.perUserBytes, 20 * 1024 * 1024);
  assert.equal(response.body.databases[0].kind, "main");

  const memberDb = response.body.databases.find((db) => db.userId === member);
  assert.equal(memberDb.owner.username, "console_member");
  const interests = memberDb.collections.find((item) => item.name === "interests");
  assert.equal(interests.records, 1);
  assert.ok(interests.totalBytes > 0);

  const sum = response.body.databases.reduce((total, db) => total + db.totalBytes, 0);
  assert.equal(response.body.usedBytes, sum);
});

test("admins list and end sessions without seeing raw session IDs", async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  await sessions().insertMany([
    { _id: "member-session-1", expires: future, session: JSON.stringify({ userId: member }) },
    { _id: "member-session-2", expires: future, session: JSON.stringify({ userId: member }) },
    { _id: "old-session", expires: new Date(Date.now() - 1000), session: "{}" }
  ]);

  const list = await adminAgent.get("/api/admin/sessions").expect(200);
  assert.equal(list.body.sessions.length, 2);
  assert.equal(list.body.sessions[0].user.username, "console_member");
  assert.ok(!JSON.stringify(list.body).includes("member-session-1"));

  await adminAgent.delete(`/api/admin/sessions/${list.body.sessions[0].handle}`).expect(200);
  await adminAgent.delete(`/api/admin/sessions/${list.body.sessions[0].handle}`).expect(404);

  const cleaned = await adminAgent.post("/api/admin/sessions/clean-expired").expect(200);
  assert.equal(cleaned.body.removed, 1);

  const signedOut = await adminAgent.post(`/api/admin/users/${member}/sign-out`).expect(200);
  assert.equal(signedOut.body.ended, 1);
  assert.equal(await sessions().countDocuments(), 0);
});

test("disabling a user removes their stored sessions", async () => {
  await sessions().insertOne({
    _id: "member-session-3",
    expires: new Date(Date.now() + 60 * 60 * 1000),
    session: JSON.stringify({ userId: member })
  });

  await adminAgent.patch(`/api/admin/users/${member}`).send({ isDisabled: true }).expect(200);
  assert.equal(await sessions().countDocuments({ _id: "member-session-3" }), 0);
  await adminAgent.patch(`/api/admin/users/${member}`).send({ isDisabled: false }).expect(200);
});

test("orphaned databases can be deleted; owned ones can't", async () => {
  const orphanId = new mongoose.Types.ObjectId().toString();
  const orphanName = `user_db_${orphanId}`;
  await mongoose.connection.client.db(orphanName).collection("interests").insertOne({ name: "Old" });

  const list = await adminAgent.get("/api/admin/databases").expect(200);
  const orphan = list.body.databases.find((db) => db.name === orphanName);
  assert.equal(orphan.orphaned, true);
  assert.equal(list.body.databases.find((db) => db.userId === member).owner.username, "console_member");

  await adminAgent.delete(`/api/admin/databases/${orphanId}`).send({ confirm: "wrong" }).expect(400);
  await adminAgent.delete(`/api/admin/databases/${member}`)
    .send({ confirm: `user_db_${member}` }).expect(400);

  await adminAgent.delete(`/api/admin/databases/${orphanId}`).send({ confirm: orphanName }).expect(200);
  assert.equal(await dbExists(orphanName), false);
});

test("deleting an account removes its database, files and sessions", async () => {
  const certification = await memberAgent.post("/api/certifications")
    .send({ name: "Cert", issuingOrganization: "Org" }).expect(201);
  const upload = await memberAgent
    .post(`/api/certifications/${certification.body.certification._id}/media/upload`)
    .field("title", "Proof")
    .attach("file", pdfBuffer, { filename: "proof.pdf", contentType: "application/pdf" })
    .expect(201);
  const filePath = path.join(process.env.UPLOAD_DIR, upload.body.media.file.key);
  assert.ok(fs.existsSync(filePath));

  await adminAgent.delete(`/api/admin/users/${admin}`).send({ confirm: "console_admin" }).expect(400);
  await adminAgent.delete(`/api/admin/users/${member}`).send({ confirm: "nope" }).expect(400);
  await adminAgent.delete(`/api/admin/users/${member}`).send({ confirm: "console_member" }).expect(200);

  assert.equal(await mongoose.connection.db.collection("users").countDocuments({ username: "console_member" }), 0);
  assert.equal(await dbExists(`user_db_${member}`), false);
  assert.equal(fs.existsSync(filePath), false);
});

test("admin actions are recorded in the audit log", async () => {
  const audit = await adminAgent.get("/api/admin/audit").expect(200);
  const actions = audit.body.entries.map((entry) => entry.action);

  for (const action of ["Delete account", "Delete orphaned database", "Change access", "Clear database cache", "Sign out everywhere"]) {
    assert.ok(actions.includes(action), `missing ${action}`);
  }

  assert.equal(audit.body.entries[0].adminUsername, "console_admin");
});
