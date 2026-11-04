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

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = require("../app")({ sessionStore: new session.MemoryStore() });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

async function signIn(username) {
  await request(app).post("/api/auth/register").send({
    username, email: `${username}@example.com`, password, confirmPassword: password
  }).expect(201);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: username, password }).expect(200);
  return agent;
}

const contact = {
  firstName: "Sai", lastName: "Udumula", email: "sai@example.com", phoneNumber: "5550100",
  addressLine: "1 Main St", country: "United States", stateProvince: "Texas", city: "Dallas",
  postalCode: "75001", linkedinUrl: "https://linkedin.com/in/example"
};

test("role details need a signed-in user and an existing profile", async () => {
  await request(app).patch("/api/profile/roles").send({ headline: "x" }).expect(401);

  const agent = await signIn("roles_noprofile");
  const { body } = await agent.patch("/api/profile/roles").send({ headline: "AI Engineer" }).expect(404);
  assert.match(body.message, /Contact Details first/);
});

test("role details are cleaned and saved", async () => {
  const agent = await signIn("roles_save");
  await agent.post("/api/profile").send({ contact }).expect(201);

  const { body } = await agent.patch("/api/profile/roles").send({
    headline: "  AI/ML Engineer building LLM agents  ",
    roleTargeting: "  Generative   AI Engineer ",
    targetRoles: ["Generative AI Engineer", " machine  learning engineer ", "Machine Learning Engineer", ""],
    employmentTypes: ["W2", "Full-time", "W2"],
    workplaceTypes: ["Remote", "On-site"],
    locations: ["Texas, United States", "Remote"],
    services: ["Freelancing", "Consulting"],
    industries: ["Information Technology", "Law & Legal Services"]
  }).expect(200);

  const roles = body.profile.roleDetails;
  assert.equal(roles.headline, "AI/ML Engineer building LLM agents");
  assert.equal(roles.roleTargeting, "Generative AI Engineer");
  // Spaces collapsed, blanks and case-insensitive duplicates dropped
  assert.deepEqual(roles.targetRoles, ["Generative AI Engineer", "machine learning engineer"]);
  // Choices keep their listed order
  assert.deepEqual(roles.employmentTypes, ["Full-time", "W2"]);
  assert.deepEqual(roles.workplaceTypes, ["On-site", "Remote"]);
  assert.deepEqual(roles.locations, ["Texas, United States", "Remote"]);

  // Updating one field leaves the others alone
  const next = await agent.patch("/api/profile/roles").send({ services: [] }).expect(200);
  assert.deepEqual(next.body.profile.roleDetails.services, []);
  assert.deepEqual(next.body.profile.roleDetails.industries, ["Information Technology", "Law & Legal Services"]);
});

test("role details enforce the limits and the fixed choices", async () => {
  const agent = await signIn("roles_limits");
  await agent.post("/api/profile").send({ contact }).expect(201);

  const tooMany = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix} ${i}`);
  await agent.patch("/api/profile/roles").send({ targetRoles: tooMany(5, "Role") }).expect(200);
  assert.match((await agent.patch("/api/profile/roles").send({ targetRoles: tooMany(6, "Role") }).expect(400)).body.message, /up to 5 roles/);

  await agent.patch("/api/profile/roles").send({ locations: tooMany(6, "City") }).expect(200);
  assert.match((await agent.patch("/api/profile/roles").send({ locations: tooMany(7, "City") }).expect(400)).body.message, /up to 6 locations/);

  await agent.patch("/api/profile/roles").send({ employmentTypes: ["Gig"] }).expect(400);
  await agent.patch("/api/profile/roles").send({ industries: ["Space Pirates"] }).expect(400);
  await agent.patch("/api/profile/roles").send({ headline: "x".repeat(221) }).expect(400);
  await agent.patch("/api/profile/roles").send({ targetRoles: ["x".repeat(81)] }).expect(400);
  await agent.patch("/api/profile/roles").send({ salary: 100 }).expect(400);
  await agent.patch("/api/profile/roles").send({ targetRoles: "AI Engineer" }).expect(400);
  // Role targeting is one role, not a list
  await agent.patch("/api/profile/roles").send({ roleTargeting: ["AI Engineer", "ML Engineer"] }).expect(400);
  await agent.patch("/api/profile/roles").send({ roleTargeting: "x".repeat(81) }).expect(400);
});
