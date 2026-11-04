const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.CLIENT_URL = "http://localhost:5173";

const password = "a-long-test-password";
const newPassword = "a-brand-new-password";

let mongoServer;
let app;
let outbox;
let User;

const lastMailTo = (email) => [...outbox].reverse().find((mail) => mail.to === email);
const tokenIn = (mail) => mail.text.match(/token=([a-f0-9]{64})/)[1];

async function register(username) {
  await request(app).post("/api/auth/register").send({
    username, email: `${username}@example.com`, password, confirmPassword: password
  }).expect(201);
}

async function signIn(identifier, pass = password) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier, password: pass }).expect(200);
  return agent;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  ({ outbox } = require("../services/mailer"));
  User = require("../models/User");
  const createApp = require("../app");
  app = createApp({ sessionStore: new session.MemoryStore() });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("forgot password gives the same answer for unknown emails and sends nothing", async () => {
  await register("forgetful");
  assert.equal(outbox.length, 0, "signing up sends no email");

  const unknown = await request(app).post("/api/auth/forgot-password")
    .send({ email: "nobody@example.com" }).expect(200);
  assert.equal(outbox.length, 0);

  const known = await request(app).post("/api/auth/forgot-password")
    .send({ email: "Forgetful@Example.com " }).expect(200);

  assert.equal(known.body.message, unknown.body.message);
  assert.match(lastMailTo("forgetful@example.com").subject, /reset/i);

  await request(app).post("/api/auth/forgot-password").send({ email: "not-an-email" }).expect(400);
});

test("a reset link sets a new password once and signs out old sessions", async () => {
  const oldSession = await signIn("forgetful");
  const token = tokenIn(lastMailTo("forgetful@example.com"));

  await request(app).post("/api/auth/reset-password/check").send({ token }).expect(200);

  // Bad passwords don't use up the link
  await request(app).post("/api/auth/reset-password")
    .send({ token, password: "short", confirmPassword: "short" }).expect(400);
  await request(app).post("/api/auth/reset-password")
    .send({ token, password: newPassword, confirmPassword: "something-else-entirely" }).expect(400);

  await request(app).post("/api/auth/reset-password")
    .send({ token, password: newPassword, confirmPassword: newPassword }).expect(200);

  await oldSession.get("/api/auth/me").expect(401);
  await request(app).post("/api/auth/login").send({ identifier: "forgetful", password }).expect(401);
  await signIn("forgetful", newPassword);

  await request(app).post("/api/auth/reset-password/check").send({ token }).expect(400);
  await request(app).post("/api/auth/reset-password")
    .send({ token, password: "yet-another-password", confirmPassword: "yet-another-password" }).expect(400);
});

test("expired reset links are rejected", async () => {
  await register("too_late");
  await request(app).post("/api/auth/forgot-password").send({ email: "too_late@example.com" }).expect(200);
  const token = tokenIn(lastMailTo("too_late@example.com"));

  await User.updateOne({ username: "too_late" }, { $set: { resetPasswordExpiresAt: new Date(Date.now() - 1000) } });

  await request(app).post("/api/auth/reset-password")
    .send({ token, password: newPassword, confirmPassword: newPassword }).expect(400);
  await request(app).post("/api/auth/login").send({ identifier: "too_late", password }).expect(200);
});

test("a signed-in user can change their password; other devices are signed out", async () => {
  await register("changer");
  const here = await signIn("changer");
  const elsewhere = await signIn("changer");

  await request(app).post("/api/auth/change-password")
    .send({ password: newPassword, confirmPassword: newPassword }).expect(401);
  await here.post("/api/auth/change-password")
    .send({ password: newPassword, confirmPassword: "does-not-match-at-all" }).expect(400);
  await here.post("/api/auth/change-password")
    .send({ password: "short", confirmPassword: "short" }).expect(400);

  await here.post("/api/auth/change-password")
    .send({ password: newPassword, confirmPassword: newPassword }).expect(200);

  await here.get("/api/auth/me").expect(200);
  await elsewhere.get("/api/auth/me").expect(401);

  await request(app).post("/api/auth/login").send({ identifier: "changer", password }).expect(401);
  await signIn("changer", newPassword);
});
