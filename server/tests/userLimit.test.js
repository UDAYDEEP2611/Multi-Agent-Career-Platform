const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.MAX_USERS = "3";

const password = "a-long-test-password";

let mongoServer;
let app;

const register = (username) =>
  request(app).post("/api/auth/register").send({
    username, email: `${username}@example.com`, password, confirmPassword: password
  });

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });
});

after(async () => {
  delete process.env.MAX_USERS;
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("sign-up stops at the account limit, even with simultaneous requests", async () => {
  await register("first_user").expect(201);

  // Five at once for the two remaining places
  const responses = await Promise.all(
    ["a_user", "b_user", "c_user", "d_user", "e_user"].map((name) => register(name))
  );

  assert.equal(responses.filter((response) => response.status === 201).length, 2);
  const refused = responses.find((response) => response.status === 403);
  assert.match(refused.body.message, /limited to 3 accounts/);

  assert.equal(await mongoose.connection.db.collection("users").countDocuments(), 3);
  await register("late_user").expect(403);
});

test("storage limits split the total across the allowed accounts", () => {
  const { storageLimits } = require("../utils/projectLimits");
  assert.deepEqual(storageLimits(), {
    totalBytes: 200 * 1024 * 1024,
    perUserBytes: (200 / 3) * 1024 * 1024
  });
});
