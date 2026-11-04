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

test("the showcase needs a signed-in user", async () => {
  await request(app).get("/api/portfolio/showcase").expect(401);
});

test("a new account gets an empty portfolio with its username, so every section shows 'add it'", async () => {
  const agent = await signIn("empty_showcase");
  const { body } = await agent.get("/api/portfolio/showcase").expect(200);
  const p = body.portfolio;

  assert.equal(p.contact.name, "empty_showcase");
  assert.equal(p.hasProfile, false);
  assert.equal(p.headline, "");
  assert.equal(p.openTo.roleTargeting, "");
  assert.equal(p.openTo.targetRoles, undefined);
  assert.equal(p.summary, "");
  for (const key of ["experiences", "educations", "projects", "skills", "certifications", "achievements", "recommendations", "volunteering", "publications", "patents", "interests"]) {
    assert.deepEqual(p[key], [], key);
  }
});

test("the showcase holds only this user's data, public recommendations, and no recommender contact details", async () => {
  const agent = await signIn("full_showcase");
  const other = await signIn("other_showcase");
  await other.post("/api/summary").send({ content: "Someone else entirely." }).expect(201);

  await agent.post("/api/summary").send({ content: "Engineer who builds AI systems." }).expect(201);
  const job = await agent.post("/api/experiences").send({
    jobTitle: "AI Engineer", organization: "Example Co", startYear: 2022, currentlyWorking: true
  }).expect(201);
  await agent.post("/api/skills").send({ name: "Python" }).expect(201);
  await agent.post("/api/recommendations").send({
    firstName: "Alex", lastName: "Lee", relationship: "Manager", text: "Dependable.",
    email: "alex@example.com", phone: "5551234", visibility: "Public",
    contextType: "experience", contextId: job.body.experience._id
  }).expect(201);
  await agent.post("/api/recommendations").send({
    firstName: "Sam", relationship: "Peer", text: "Private note.", visibility: "Private"
  }).expect(201);

  const { body } = await agent.get("/api/portfolio/showcase").expect(200);
  const p = body.portfolio;
  assert.equal(p.summary, "Engineer who builds AI systems.");
  assert.equal(p.headline, "AI Engineer");
  assert.deepEqual(p.skills.map((skill) => skill.name), ["Python"]);
  assert.deepEqual(p.recommendations.map((item) => item.name), ["Alex Lee"]);
  assert.equal(JSON.stringify(p.recommendations).includes("alex@example.com"), false);
  assert.equal(JSON.stringify(p.recommendations).includes("5551234"), false);
});

test("the Role Details headline and preferences lead the showcase", async () => {
  const agent = await signIn("roles_showcase");
  await agent.post("/api/experiences").send({
    jobTitle: "Data Analyst", organization: "Example Co", startYear: 2021, currentlyWorking: true
  }).expect(201);
  await agent.post("/api/profile").send({ contact: {
    firstName: "Ria", lastName: "Shah", email: "ria@example.com", phoneNumber: "5550100",
    addressLine: "1 Main St", country: "United States", stateProvince: "Texas", city: "Dallas", postalCode: "75001",
    linkedinUrl: "https://linkedin.com/in/example"
  } }).expect(201);

  const before = await agent.get("/api/portfolio/showcase").expect(200);
  assert.equal(before.body.portfolio.headline, "Data Analyst");

  await agent.patch("/api/profile/roles").send({
    headline: "AI Engineer building LLM agents",
    roleTargeting: "Generative AI Engineer",
    targetRoles: ["Machine Learning Engineer"],
    employmentTypes: ["Full-time"],
    workplaceTypes: ["Remote"]
  }).expect(200);

  const { body } = await agent.get("/api/portfolio/showcase").expect(200);
  assert.equal(body.portfolio.headline, "AI Engineer building LLM agents");
  // One role for resumes and portfolios; the other roles stay private
  assert.equal(body.portfolio.openTo.roleTargeting, "Generative AI Engineer");
  assert.equal(body.portfolio.openTo.targetRoles, undefined);
  assert.deepEqual(body.portfolio.openTo.workplaceTypes, ["Remote"]);
});
