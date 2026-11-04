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
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "project-uploads-"));

const pdfBuffer = Buffer.from("%PDF-1.4\n% integration test file\n%%EOF\n");

let mongoServer;
const userIdA = new mongoose.Types.ObjectId().toString();
let app;
let agentA;
let agentB;
let projectId;

const storedFileExists = (key) => fs.existsSync(path.join(process.env.UPLOAD_DIR, key));

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");

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

const base = (id = projectId) => `/api/projects/${id}`;

test("projects require sign-in", async () => {
  await request(app).get("/api/projects").expect(401);
});

test("projects can be created, listed, updated and validated", async () => {
  const created = await agentA.post("/api/projects").send({
    title: "  Portfolio Agent ",
    projectType: "Open Source",
    role: "Lead developer",
    startMonth: 1,
    startYear: 2024,
    ongoing: true,
    githubUrl: "https://github.com/example/repo"
  }).expect(201);

  projectId = created.body.project._id;
  assert.equal(created.body.project.title, "Portfolio Agent");
  assert.equal(created.body.project.visibility, "Public");

  await agentA.post("/api/projects").send({
    title: "Old project", startYear: 2020, endYear: 2021, status: "Completed"
  }).expect(201);
  const featured = (await agentA.post("/api/projects").send({
    title: "Featured", featured: true
  }).expect(201)).body.project._id;

  // Featured first, then ongoing, then most recently ended
  const list = await agentA.get("/api/projects").expect(200);
  assert.deepEqual(list.body.projects.map((p) => p.title), ["Featured", "Portfolio Agent", "Old project"]);

  // Turning off ongoing with an end date
  const updated = await agentA.patch(base()).send({
    ongoing: false, endMonth: 6, endYear: 2024, visibility: "Private"
  }).expect(200);
  assert.equal(updated.body.project.endYear, 2024);
  assert.equal(updated.body.project.githubUrl, "https://github.com/example/repo");

  // Ongoing clears the end date
  const ongoing = await agentA.patch(base()).send({ ongoing: true }).expect(200);
  assert.equal(ongoing.body.project.endYear, null);

  const nextYear = new Date().getFullYear() + 1;
  for (const body of [
    { title: "" },
    { title: "x", projectType: "Hobby" },
    { title: "x", status: "Done" },
    { title: "x", visibility: "Friends" },
    { title: "x", startYear: nextYear },
    { title: "x", startYear: 2024, endYear: 2023 },
    { title: "x", startMonth: 3 },
    { title: "x", githubUrl: "javascript:alert(1)" },
    { title: "x", demoUrl: "not a url" },
    { title: "x", featured: "yes" },
    { title: "x", userId: new mongoose.Types.ObjectId().toString() }
  ]) {
    await agentA.post("/api/projects").send(body).expect(400);
  }

  await agentA.delete(base(featured)).expect(200);
});

test("other users cannot see or change a project or its sections", async () => {
  await agentB.get(base()).expect(404);
  await agentB.patch(base()).send({ title: "Hacked" }).expect(404);
  await agentB.delete(base()).expect(404);
  await agentB.get(`${base()}/tasks`).expect(404);
  await agentB.post(`${base()}/achievements`).send({ title: "x" }).expect(404);
  await agentB.post(`${base()}/links`).send({ title: "x", url: "https://a.com" }).expect(404);
  assert.equal((await agentB.get("/api/projects")).body.projects.length, 0);

  await agentA.get(`${base("nope")}`).expect(400);
});

test("tasks and contributors work on standalone projects", async () => {
  const task = await agentA.post(`${base()}/tasks`).send({ description: "Built the API" }).expect(201);
  await agentA.patch(`${base()}/tasks/${task.body.task._id}`).send({ description: "Built the REST API" }).expect(200);
  assert.equal((await agentA.get(`${base()}/tasks`)).body.tasks[0].description, "Built the REST API");

  const person = await agentA.post(`${base()}/contributors`).send({ name: "Alex", role: "Designer" }).expect(201);
  assert.equal(person.body.contributor.name, "Alex");
  await agentA.delete(`${base()}/contributors/${person.body.contributor._id}`).expect(200);
});

test("achievements and links can be managed", async () => {
  const achievement = await agentA.post(`${base()}/achievements`).send({
    title: "Cut response time", category: "Metric", metric: "40% faster", year: 2024
  }).expect(201);
  const achievementId = achievement.body.achievement._id;

  await agentA.patch(`${base()}/achievements/${achievementId}`).send({ metric: "45% faster" }).expect(200);
  const achievements = (await agentA.get(`${base()}/achievements`)).body.achievements;
  assert.equal(achievements[0].metric, "45% faster");
  assert.equal(achievements[0].title, "Cut response time");

  await agentA.post(`${base()}/achievements`).send({ title: "" }).expect(400);
  await agentA.post(`${base()}/achievements`).send({ title: "x", category: "Fame" }).expect(400);
  await agentA.post(`${base()}/achievements`).send({ title: "x", year: new Date().getFullYear() + 1 }).expect(400);

  const link = await agentA.post(`${base()}/links`).send({
    title: "Docs", linkType: "Documentation", url: "https://docs.example.com"
  }).expect(201);
  await agentA.post(`${base()}/links`).send({ title: "Bad", url: "ftp://x.com" }).expect(400);
  await agentA.post(`${base()}/links`).send({ title: "Bad", linkType: "Blog", url: "https://x.com" }).expect(400);

  await agentA.delete(`${base()}/links/${link.body.link._id}`).expect(200);
  await agentA.delete(`${base()}/links/${link.body.link._id}`).expect(404);
  await agentA.delete(`${base()}/achievements/${achievementId}`).expect(200);
});

test("deleting a project removes its files and skill links", async () => {
  const upload = await agentA
    .post(`${base()}/media/upload`)
    .field("title", "Architecture")
    .attach("file", pdfBuffer, "architecture.pdf")
    .expect(201);
  const key = upload.body.media.file.key;
  assert.ok(storedFileExists(key));
  assert.match(key, /^project-media\//);

  const download = await agentA
    .get(`${base()}/media/${upload.body.media._id}/download`)
    .buffer(true)
    .parse((res, done) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    })
    .expect(200);
  assert.deepEqual(download.body, pdfBuffer);
  await agentB.get(`${base()}/media/${upload.body.media._id}/download`).expect(404);

  const skill = (await agentA.post("/api/skills").send({ name: "Node.js" }).expect(201)).body.skill._id;
  await agentA.post("/api/skill-associations")
    .send({ skillId: skill, sourceType: "project", sourceId: projectId })
    .expect(201);
  const linked = await agentA.get(`/api/skill-associations/source/project/${projectId}`).expect(200);
  assert.deepEqual(linked.body.associations.map((a) => a.skillId.name), ["Node.js"]);

  // B can't link to A's project
  const skillB = (await agentB.post("/api/skills").send({ name: "Go" }).expect(201)).body.skill._id;
  await agentB.post("/api/skill-associations")
    .send({ skillId: skillB, sourceType: "project", sourceId: projectId })
    .expect(404);

  await agentA.delete(base()).expect(200);

  assert.ok(!storedFileExists(key));
  const SkillAssociation = require("../models/SkillAssociation");
  assert.equal(
    await runAsUser(userIdA, () => SkillAssociation.countDocuments({ sourceId: projectId })),
    0
  );
  // The master skill stays
  assert.equal((await agentA.get("/api/skills")).body.total, 1);
});

test("a project's status defaults from ongoing: In Progress, else Completed", async () => {
  const ongoing = (await agentA.post("/api/projects").send({ title: "Status ongoing", ongoing: true }).expect(201)).body.project;
  assert.equal(ongoing.status, "In Progress");
  assert.equal(ongoing.role, "Creator/Developer");

  const done = (await agentA.post("/api/projects").send({ title: "Status done", ongoing: false }).expect(201)).body.project;
  assert.equal(done.status, "Completed");

  // Finishing an ongoing project completes it; a chosen status is kept
  let updated = (await agentA.patch(`/api/projects/${ongoing._id}`).send({ ongoing: false }).expect(200)).body.project;
  assert.equal(updated.status, "Completed");
  updated = (await agentA.patch(`/api/projects/${ongoing._id}`).send({ status: "On Hold" }).expect(200)).body.project;
  assert.equal(updated.status, "On Hold");
  updated = (await agentA.patch(`/api/projects/${ongoing._id}`).send({ title: "Renamed" }).expect(200)).body.project;
  assert.equal(updated.status, "On Hold");
});
