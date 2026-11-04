const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.GOOGLE_CLIENT_ID = "uuv-test.apps.googleusercontent.com";

const password = "a-long-test-password";

// Real signed tokens: only Google's public keys are replaced
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({
  certs: { "test-key": publicKey.export({ type: "spki", format: "pem" }) },
  format: "PEM"
});

const base64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function token(claims = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${base64({ alg: "RS256", kid: "test-key", typ: "JWT" })}.${base64({
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    iat: now,
    exp: now + 3600,
    email_verified: true,
    ...claims
  })}`;
  return `${body}.${crypto.sign("RSA-SHA256", Buffer.from(body), key).toString("base64url")}`;
}

let mongoServer;
let app;
let User;

const google = (claims, extra = {}, agent = request(app)) =>
  agent.post("/api/auth/google").send({ credential: token(claims), ...extra });

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ sessionStore: new session.MemoryStore() });
  User = require("../models/User");
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("the client is told the Google client id", async () => {
  const { body } = await request(app).get("/api/auth/google/config").expect(200);
  assert.equal(body.clientId, process.env.GOOGLE_CLIENT_ID);
});

test("without a client id the button is hidden and sign-in is refused", async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  const credential = token();
  process.env.GOOGLE_CLIENT_ID = "";
  try {
    assert.equal((await request(app).get("/api/auth/google/config").expect(200)).body.clientId, "");
    await request(app).post("/api/auth/google").send({ credential }).expect(503);
  } finally {
    process.env.GOOGLE_CLIENT_ID = saved;
  }
});

test("a first Google sign-in creates a signed-in account, and the next one reuses it", async () => {
  const agent = request.agent(app);
  const created = await google({ sub: "g-new", email: "Rajendra.Prasad@gmail.com" }, {}, agent).expect(201);
  assert.equal(created.body.user.username, "rajendra_prasad");
  assert.equal(created.body.user.email, "rajendra.prasad@gmail.com");

  const { body } = await agent.get("/api/auth/me").expect(200);
  assert.deepEqual(body.user.authProviders, ["google"]);
  assert.equal(body.user.isEmailVerified, true);

  const again = await google({ sub: "g-new", email: "rajendra.prasad@gmail.com" }).expect(200);
  assert.equal(again.body.user.id, created.body.user.id);
  assert.equal(await User.countDocuments({ email: "rajendra.prasad@gmail.com" }), 1);
});

test("tokens that aren't valid for this app are refused", async () => {
  const claims = { sub: "g-bad", email: "bad@gmail.com" };
  const { privateKey: otherKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);

  for (const credential of [
    token({ ...claims, aud: "another-app.apps.googleusercontent.com" }),
    token({ ...claims, iss: "https://evil.example.com" }),
    token({ ...claims, iat: now - 7200, exp: now - 3600 }),
    token(claims, otherKey)
  ]) {
    await request(app).post("/api/auth/google").send({ credential }).expect(401);
  }
  assert.equal(await User.countDocuments({ email: "bad@gmail.com" }), 0);
});

test("an unverified Google email can't create or reach an account", async () => {
  await google({ sub: "g-unverified", email: "unverified@gmail.com", email_verified: false }).expect(403);
  assert.equal(await User.countDocuments({ email: "unverified@gmail.com" }), 0);
});

test("a password account is only connected with its password", async () => {
  await request(app).post("/api/auth/register").send({
    username: "has_password", email: "owner@gmail.com", password, confirmPassword: password
  }).expect(201);
  const claims = { sub: "g-owner", email: "owner@gmail.com" };
  const linkedId = async () => (await User.findOne({ email: "owner@gmail.com" })).googleId;

  const asked = await google(claims).expect(409);
  assert.equal(asked.body.needsPassword, true);
  assert.equal(await linkedId(), undefined);

  const wrong = await google(claims, { password: "not-the-password" }).expect(401);
  assert.equal(wrong.body.needsPassword, true);
  assert.equal(await linkedId(), undefined);

  const agent = request.agent(app);
  await google(claims, { password }, agent).expect(200);
  assert.equal(await linkedId(), "g-owner");
  assert.deepEqual((await agent.get("/api/auth/me").expect(200)).body.user.authProviders, ["local", "google"]);

  // Both ways in keep working, and the password isn't asked for again
  await google(claims).expect(200);
  await request(app).post("/api/auth/login").send({ identifier: "has_password", password }).expect(200);

  // Another Google account can't take over the same email
  await google({ sub: "g-someone-else", email: "owner@gmail.com" }).expect(409);
  assert.equal(await linkedId(), "g-owner");
});

test("a taken username gets a suffix", async () => {
  await request(app).post("/api/auth/register").send({
    username: "same_name", email: "first@example.com", password, confirmPassword: password
  }).expect(201);
  const { body } = await google({ sub: "g-same", email: "same.name@gmail.com" }).expect(201);
  assert.match(body.user.username, /^same_name_[a-f0-9]{4}$/);
});

test("disabled accounts can't sign in with Google", async () => {
  await google({ sub: "g-disabled", email: "disabled@gmail.com" }).expect(201);
  await User.updateOne({ googleId: "g-disabled" }, { isDisabled: true });
  await google({ sub: "g-disabled", email: "disabled@gmail.com" }).expect(403);
});

test("the account limit applies to Google sign-ups", async () => {
  const saved = process.env.MAX_USERS;
  process.env.MAX_USERS = "1";
  try {
    await google({ sub: "g-full", email: "full@gmail.com" }).expect(403);
    assert.equal(await User.countDocuments({ email: "full@gmail.com" }), 0);
  } finally {
    if (saved === undefined) delete process.env.MAX_USERS;
    else process.env.MAX_USERS = saved;
  }
});

test("a Google-only account opens its activity log with Google, and can add a password", async () => {
  const agent = request.agent(app);
  const claims = { sub: "g-log", email: "log.owner@gmail.com" };
  await google(claims, {}, agent).expect(201);

  const status = (await agent.get("/api/account/lock").expect(200)).body;
  assert.equal(status.hasPassword, false);
  assert.equal(status.hasGoogle, true);

  const unlock = (credential) => agent.post("/api/account/unlock").send({ credential });
  const now = Math.floor(Date.now() / 1000);
  await unlock(token({ sub: "g-other", email: "other@gmail.com" })).expect(401);
  await unlock(token({ ...claims, iat: now - 3600 })).expect(401);
  await agent.get("/api/account/activity").expect(423);

  await unlock(token(claims)).expect(200);
  await agent.get("/api/account/activity").expect(200);

  await agent.post("/api/auth/change-password").send({ password, confirmPassword: password }).expect(200);
  await request(app).post("/api/auth/login").send({ identifier: "log.owner@gmail.com", password }).expect(200);
  assert.equal((await agent.get("/api/account/lock").expect(200)).body.hasPassword, true);
});
