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
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "achievement-uploads-"));

const pdfBuffer = Buffer.from("%PDF-1.4\n% integration test file\n%%EOF\n");

let mongoServer;
let app;
let agentA;
let agentB;
let educationB;
let achievementId;

const storedFileExists = (key) => fs.existsSync(path.join(process.env.UPLOAD_DIR, key));

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });

  agentA = request.agent(app);
  agentB = request.agent(app);

  for (const agent of [agentA, agentB]) {
    await agent
      .post("/__test/login")
      .send({ userId: new mongoose.Types.ObjectId().toString() })
      .expect(200);
  }

  // An education that belongs to user B, not user A
  const education = await agentB.post("/api/educations").send({
    institution: "Example University", degree: "Bachelor of Science", startYear: 2018
  }).expect(201);
  educationB = education.body.education._id;
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

const base = (id = achievementId) => `/api/achievements/${id}`;

test("achievements require sign-in", async () => {
  await request(app).get("/api/achievements").expect(401);
});

test("achievements can be created, listed, updated and validated", async () => {
  const experience = await agentA.post("/api/experiences").send({
    jobTitle: "Engineer", organization: "Example Co", startYear: 2022, currentlyWorking: true
  }).expect(201);

  const created = await agentA.post("/api/achievements").send({
    title: "  Hackathon Winner ",
    category: "Hackathon",
    issuer: "Example Org",
    result: "1st place",
    contextType: "experience",
    contextId: experience.body.experience._id,
    month: 5,
    year: 2024,
    url: "https://example.com/results"
  }).expect(201);

  achievementId = created.body.achievement._id;
  assert.equal(created.body.achievement.title, "Hackathon Winner");

  await agentA.post("/api/achievements").send({
    title: "Dean's List", category: "Honor", year: 2020, featured: true
  }).expect(201);

  const list = await agentA.get("/api/achievements").expect(200);
  assert.deepEqual(
    list.body.achievements.map((item) => item.title),
    ["Dean's List", "Hackathon Winner"]
  );

  const nextYear = new Date().getFullYear() + 1;
  const valid = { title: "X", category: "Award" };
  const invalid = [
    [{ category: "Award" }, /Title is required/],
    [{ title: "X" }, /category/],
    [{ ...valid, category: "Nap" }, /category/],
    [{ ...valid, year: nextYear }, /future/],
    [{ ...valid, month: 2 }, /Year is required/],
    [{ ...valid, result: "x".repeat(101) }, /at most 100/],
    [{ ...valid, url: "javascript:alert(1)" }, /http/],
    [{ ...valid, contextType: "education", contextId: educationB }, /your experiences/],
    [{ ...valid, userId: "x" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/achievements").send(body).expect(400);
    assert.match(response.body.message, message);
  }

  const updated = await agentA.patch(base()).send({ result: "Winner", contextType: null }).expect(200);
  assert.equal(updated.body.achievement.result, "Winner");
  assert.equal(updated.body.achievement.contextId, null);
  assert.equal(updated.body.achievement.issuer, "Example Org");
});

test("other users cannot see or change an achievement", async () => {
  await agentB.get(base()).expect(404);
  await agentB.patch(base()).send({ title: "Taken" }).expect(404);
  await agentB.get(`${base()}/media`).expect(404);
  await agentB.delete(base()).expect(404);
});

test("media uploads work and deleting the achievement removes its files", async () => {
  const upload = await agentA
    .post(`${base()}/media/upload`)
    .field("title", "Certificate")
    .attach("file", pdfBuffer, { filename: "award.pdf", contentType: "application/pdf" })
    .expect(201);

  const key = upload.body.media.file.key;
  assert.match(key, /^achievement-media\//);
  assert.ok(storedFileExists(key));

  await agentA.delete(base()).expect(200);
  assert.equal(storedFileExists(key), false);
  await agentA.get(base()).expect(404);
});
