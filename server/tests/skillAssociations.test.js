const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { runAsUser } = require("../utils/userDatabase");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "skill-links-"));

let mongoServer;
const userIdA = new mongoose.Types.ObjectId().toString();
let app;
let agentA;
let agentB;
let SkillAssociation;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  SkillAssociation = require("../models/SkillAssociation");

  app = createApp({
    enableTestAuth: true,
    sessionStore: new session.MemoryStore()
  });

  agentA = request.agent(app);
  agentB = request.agent(app);

  await agentA.post("/__test/login").send({ userId: userIdA }).expect(200);
  await agentB
    .post("/__test/login")
    .send({ userId: new mongoose.Types.ObjectId().toString() })
    .expect(200);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

// Creates an experience and an education, each with one project
async function createRecords(agent) {
  const experience = (await agent.post("/api/experiences").send({
    jobTitle: "Engineer", organization: "Org", startYear: 2024, currentlyWorking: true
  }).expect(201)).body.experience._id;

  const experienceProject = (await agent
    .post(`/api/experiences/${experience}/projects`)
    .send({ title: "Work project" })
    .expect(201)).body.project._id;

  const education = (await agent.post("/api/educations").send({
    institution: "University", degree: "BSc"
  }).expect(201)).body.education._id;

  const educationProject = (await agent
    .post(`/api/educations/${education}/projects`)
    .send({ title: "School project" })
    .expect(201)).body.project._id;

  return { experience, experienceProject, education, educationProject };
}

const link = (agent, skillId, sourceType, sourceId) =>
  agent.post("/api/skill-associations").send({ skillId, sourceType, sourceId });

const linkedNames = async (agent, sourceType, sourceId) =>
  (await agent
    .get(`/api/skill-associations/source/${sourceType}/${sourceId}`)
    .expect(200)).body.associations.map((item) => item.skillId.name);

test("unauthenticated users cannot use skill links", async () => {
  await request(app).get("/api/skill-associations/skill/abc").expect(401);
  await request(app).post("/api/skill-associations").send({}).expect(401);
});

test("one master skill links to all four record types without duplicating it", async () => {
  const records = await createRecords(agentA);
  const python = (await agentA.post("/api/skills").send({ name: "Python", rating: 5 }).expect(201)).body.skill._id;

  for (const [type, id] of [
    ["experience", records.experience],
    ["education", records.education],
    ["experience_project", records.experienceProject],
    ["education_project", records.educationProject]
  ]) {
    const created = await link(agentA, python, type, id).expect(201);
    assert.equal(created.body.association.skillId.name, "Python");
    assert.deepEqual(await linkedNames(agentA, type, id), ["Python"]);
  }

  // Still just one Python in the master list
  assert.equal((await agentA.get("/api/skills")).body.total, 1);

  const all = await agentA.get(`/api/skill-associations/skill/${python}`).expect(200);
  assert.equal(all.body.associations.length, 4);

  // Linking twice to the same record is refused
  await link(agentA, python, "experience", records.experience).expect(409);

  // Removing a link keeps the skill
  const linkId = all.body.associations.find((item) => item.sourceType === "education")._id;
  await agentA.delete(`/api/skill-associations/${linkId}`).expect(200);
  assert.deepEqual(await linkedNames(agentA, "education", records.education), []);
  assert.equal((await agentA.get("/api/skills")).body.total, 1);
});

test("links are refused for other users' skills and records", async () => {
  const recordsA = await createRecords(agentA);
  const skillA = (await agentA.post("/api/skills").send({ name: "SQL" }).expect(201)).body.skill._id;
  const skillB = (await agentB.post("/api/skills").send({ name: "SQL" }).expect(201)).body.skill._id;

  // B's skill on A's records, and A's skill via B's session
  await link(agentB, skillB, "experience", recordsA.experience).expect(404);
  await link(agentB, skillB, "education_project", recordsA.educationProject).expect(404);
  await link(agentB, skillA, "experience", recordsA.experience).expect(404);

  // B can't read or remove A's links
  const created = await link(agentA, skillA, "experience", recordsA.experience).expect(201);
  await agentB.get(`/api/skill-associations/source/experience/${recordsA.experience}`).expect(404);
  await agentB.get(`/api/skill-associations/skill/${skillA}`).expect(404);
  await agentB.delete(`/api/skill-associations/${created.body.association._id}`).expect(404);

  // Bad input
  await link(agentA, skillA, "job", recordsA.experience).expect(400);
  // A standalone project ID that doesn't exist
  await link(agentA, skillA, "project", recordsA.experience).expect(404);
  await link(agentA, skillA, "toString", recordsA.experience).expect(400);
  await link(agentA, "nope", "experience", recordsA.experience).expect(400);
  // A project ID is not an experience ID
  await link(agentA, skillA, "experience", recordsA.experienceProject).expect(404);
});

test("deleting a skill or a record removes its links", async () => {
  const records = await createRecords(agentA);
  const go = (await agentA.post("/api/skills").send({ name: "Go" }).expect(201)).body.skill._id;
  const rust = (await agentA.post("/api/skills").send({ name: "Rust" }).expect(201)).body.skill._id;

  for (const skill of [go, rust]) {
    for (const [type, id] of [
      ["experience", records.experience],
      ["experience_project", records.experienceProject],
      ["education", records.education],
      ["education_project", records.educationProject]
    ]) {
      await link(agentA, skill, type, id).expect(201);
    }
  }

  const count = (filter) => runAsUser(userIdA, () => SkillAssociation.countDocuments(filter));

  await agentA.delete(`/api/skills/${go}`).expect(200);
  assert.equal(await count({ skillId: go }), 0);
  assert.equal(await count({ skillId: rust }), 4);

  await agentA
    .delete(`/api/experiences/${records.experience}/projects/${records.experienceProject}`)
    .expect(200);
  assert.equal(await count({ sourceId: records.experienceProject }), 0);
  assert.equal(await count({ sourceId: records.experience }), 1);

  await agentA.delete(`/api/experiences/${records.experience}`).expect(200);
  assert.equal(await count({ sourceId: records.experience }), 0);

  await agentA.delete(`/api/educations/${records.education}`).expect(200);
  assert.equal(await count({ sourceId: records.education }), 0);
  assert.equal(await count({ sourceId: records.educationProject }), 0);
  assert.equal(await count({ skillId: rust }), 0);
});
