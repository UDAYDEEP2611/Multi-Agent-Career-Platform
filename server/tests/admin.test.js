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
let User;
let admin;
let member;
let adminAgent;
let memberAgent;

const password = "a-long-test-password";

async function register(username) {
  const response = await request(app).post("/api/auth/register").send({
    username,
    email: `${username}@example.com`,
    password,
    confirmPassword: password
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
  User = require("../models/User");
  await require("../models/SkillCatalog").syncIndexes();
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });

  admin = await register("site_admin");
  member = await register("member_one");

  const { setAdmin } = require("../scripts/makeAdmin");
  await setAdmin("site_admin@example.com");

  adminAgent = await signIn(admin);
  memberAgent = await signIn(member);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("only admins can use the admin routes", async () => {
  await request(app).get("/api/admin/users").expect(401);
  await memberAgent.get("/api/admin/users").expect(403);
  await memberAgent.post("/api/admin/skill-catalog").send({ name: "X" }).expect(403);

  const me = await adminAgent.get("/api/auth/me").expect(200);
  assert.equal(me.body.user.role, "admin");
  assert.equal((await memberAgent.get("/api/auth/me").expect(200)).body.user.role, "user");
});

test("admin accounts have no portfolio", async () => {
  // Signing in and /me still work for admins
  assert.equal((await adminAgent.get("/api/auth/me").expect(200)).body.user.role, "admin");

  for (const url of ["/api/interests", "/api/experiences", "/api/skills", "/api/profile"]) {
    const response = await adminAgent.get(url).expect(403);
    assert.match(response.body.message, /don't have a portfolio/);
  }

  // make-admin removed the admin's empty portfolio database
  const names = (await mongoose.connection.db.admin().listDatabases({ nameOnly: true }))
    .databases.map((db) => db.name);
  assert.ok(!names.includes(`user_db_${admin}`));
});

test("promoting a user with no data removes their empty database", async () => {
  const fresh = await register("fresh_user");
  const exists = async () =>
    (await mongoose.connection.db.admin().listDatabases({ nameOnly: true }))
      .databases.some((db) => db.name === `user_db_${fresh}`);

  assert.ok(await exists());
  await adminAgent.patch(`/api/admin/users/${fresh}`).send({ role: "admin" }).expect(200);
  assert.equal(await exists(), false);

  await adminAgent.patch(`/api/admin/users/${fresh}`).send({ role: "user" }).expect(200);
  await User.deleteOne({ _id: fresh });
});

test("admins see every account with its database size", async () => {
  await memberAgent.post("/api/interests").send({ name: "Chess" }).expect(201);

  const response = await adminAgent.get("/api/admin/users").expect(200);
  assert.equal(response.body.summary.total, 2);
  assert.equal(response.body.summary.admins, 1);

  const row = response.body.users.find((user) => user.id === member);
  assert.equal(row.database.name, `user_db_${member}`);
  assert.ok(row.database.records >= 1);
  assert.equal(row.passwordHash, undefined);
});

test("admins can promote, disable and re-enable accounts, with safeguards", async () => {
  await adminAgent.patch(`/api/admin/users/${admin}`).send({ role: "user" }).expect(400);
  await adminAgent.patch(`/api/admin/users/${member}`).send({ role: "owner" }).expect(400);
  await adminAgent.patch(`/api/admin/users/${member}`).send({ passwordHash: "x" }).expect(400);

  // Disabling ends the member's session and blocks sign-in
  await adminAgent.patch(`/api/admin/users/${member}`).send({ isDisabled: true }).expect(200);
  const blocked = await memberAgent.get("/api/interests").expect(403);
  assert.match(blocked.body.message, /disabled/);

  const login = await request(app).post("/api/auth/login")
    .send({ identifier: "member_one", password }).expect(403);
  assert.match(login.body.message, /disabled/);

  await adminAgent.patch(`/api/admin/users/${member}`).send({ isDisabled: false }).expect(200);
  await request(app).post("/api/auth/login").send({ identifier: "member_one", password }).expect(200);

  // Admins can promote and demote others, but never themselves
  const promoted = await adminAgent.patch(`/api/admin/users/${member}`).send({ role: "admin" }).expect(200);
  assert.equal(promoted.body.user.role, "admin");

  const memberAsAdmin = await signIn(member);
  await memberAsAdmin.get("/api/admin/users").expect(200);
  await memberAsAdmin.patch(`/api/admin/users/${member}`).send({ role: "user" }).expect(400);

  // Removing the role takes effect on the next request
  await adminAgent.patch(`/api/admin/users/${member}`).send({ role: "user" }).expect(200);
  await memberAsAdmin.get("/api/admin/users").expect(403);
});

test("admins manage the shared skill suggestions", async () => {
  const created = await adminAgent.post("/api/admin/skill-catalog")
    .send({ name: " Rust ", skillType: "technical" }).expect(201);
  const id = created.body.skill._id;

  await adminAgent.post("/api/admin/skill-catalog").send({ name: "rust" }).expect(409);
  await adminAgent.post("/api/admin/skill-catalog").send({ name: "X", skillType: "magic" }).expect(400);

  const memberAgain = await signIn(member);
  const search = await memberAgain.get("/api/skill-catalog/search?q=ru").expect(200);
  assert.ok(search.body.suggestions.some((skill) => skill.name === "Rust"));

  await adminAgent.patch(`/api/admin/skill-catalog/${id}`).send({ name: "Rust Lang" }).expect(200);
  await adminAgent.delete(`/api/admin/skill-catalog/${id}`).expect(200);
  assert.equal((await adminAgent.get("/api/admin/skill-catalog").expect(200)).body.skills.length, 0);
});
