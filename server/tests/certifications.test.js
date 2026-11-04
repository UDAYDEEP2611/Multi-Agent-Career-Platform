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
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "certification-uploads-"));

const pdfBuffer = Buffer.from("%PDF-1.4\n% integration test file\n%%EOF\n");

let mongoServer;
const userIdA = new mongoose.Types.ObjectId().toString();
let app;
let agentA;
let agentB;
let certificationId;

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

const base = (id = certificationId) => `/api/certifications/${id}`;

test("certifications require sign-in", async () => {
  await request(app).get("/api/certifications").expect(401);
});

test("certifications can be created, listed, updated and validated", async () => {
  const created = await agentA.post("/api/certifications").send({
    name: "  Cloud Practitioner ",
    issuingOrganization: "Example Org",
    issueMonth: 3,
    issueYear: 2023,
    expirationMonth: 3,
    expirationYear: 2099,
    credentialId: "ABC-123",
    credentialUrl: "https://example.com/verify/abc"
  }).expect(201);

  certificationId = created.body.certification._id;
  assert.equal(created.body.certification.name, "Cloud Practitioner");

  await agentA.post("/api/certifications").send({
    name: "Older", issuingOrganization: "Example Org", issueYear: 2019
  }).expect(201);

  const list = await agentA.get("/api/certifications").expect(200);
  assert.deepEqual(
    list.body.certifications.map((item) => item.name),
    ["Cloud Practitioner", "Older"]
  );
  assert.deepEqual(list.body.certifications[0].skills, []);

  // The issuing organization is optional
  const noOrg = await agentA.post("/api/certifications").send({ name: "Self-study Certificate" }).expect(201);
  assert.equal(noOrg.body.certification.issuingOrganization, "");
  await agentA.delete(`/api/certifications/${noOrg.body.certification._id}`).expect(200);

  const nextYear = new Date().getFullYear() + 1;
  const invalid = [
    [{ issuingOrganization: "Org" }, /Name is required/],
    [{ name: "X", issuingOrganization: "Org", issueYear: nextYear }, /future/],
    [{ name: "X", issuingOrganization: "Org", issueMonth: 2 }, /Issue year is required/],
    [
      { name: "X", issuingOrganization: "Org", issueYear: 2022, expirationYear: 2021 },
      /earlier than issue date/
    ],
    [{ name: "X", issuingOrganization: "Org", credentialId: "x".repeat(81) }, /at most 80/],
    [{ name: "X", issuingOrganization: "Org", credentialUrl: "javascript:alert(1)" }, /http/],
    [{ name: "X", issuingOrganization: "Org", userId: "someone" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/certifications").send(body).expect(400);
    assert.match(response.body.message, message);
  }

  const updated = await agentA.patch(base()).send({ credentialId: "NEW-1" }).expect(200);
  assert.equal(updated.body.certification.credentialId, "NEW-1");
  assert.equal(updated.body.certification.issuingOrganization, "Example Org");
});

test("other users cannot see or change a certification", async () => {
  await agentB.get(base()).expect(404);
  await agentB.patch(base()).send({ name: "Taken" }).expect(404);
  await agentB.get(`${base()}/media`).expect(404);
  await agentB.delete(base()).expect(404);

  const list = await agentB.get("/api/certifications").expect(200);
  assert.equal(list.body.certifications.length, 0);
});

test("certification media is limited to 50 items", async () => {
  const upload = await agentA
    .post(`${base()}/media/upload`)
    .field("title", "Certificate")
    .attach("file", pdfBuffer, { filename: "certificate.pdf", contentType: "application/pdf" })
    .expect(201);

  assert.match(upload.body.media.file.key, /^certification-media\//);

  for (let index = 0; index < 49; index += 1) {
    await agentA
      .post(`${base()}/media/links`)
      .send({ title: `Link ${index}`, url: "https://example.com" })
      .expect(201);
  }

  const full = await agentA
    .post(`${base()}/media/links`)
    .send({ title: "One too many", url: "https://example.com" })
    .expect(400);
  assert.match(full.body.message, /up to 50 media items per certification/);
});

test("skills link to certifications and are listed with them", async () => {
  const skill = await agentA.post("/api/skills").send({ name: "Cloud Computing" }).expect(201);

  await agentA.post("/api/skill-associations").send({
    skillId: skill.body.skill._id,
    sourceType: "certification",
    sourceId: certificationId
  }).expect(201);

  const list = await agentA.get("/api/certifications").expect(200);
  const certification = list.body.certifications.find((item) => item._id === certificationId);
  assert.deepEqual(certification.skills.map((item) => item.name), ["Cloud Computing"]);

  // Another user can't link to this certification
  const otherSkill = await agentB.post("/api/skills").send({ name: "Networking" }).expect(201);
  await agentB.post("/api/skill-associations").send({
    skillId: otherSkill.body.skill._id,
    sourceType: "certification",
    sourceId: certificationId
  }).expect(404);
});

test("deleting a certification removes its files and skill links", async () => {
  const certification = (await agentA.get(base()).expect(200)).body.certification;
  const fileKey = certification.media.find((item) => item.mediaType === "File").file.key;
  assert.ok(storedFileExists(fileKey));

  await agentA.delete(base()).expect(200);

  assert.equal(storedFileExists(fileKey), false);

  const SkillAssociation = require("../models/SkillAssociation");
  assert.equal(
    await runAsUser(userIdA, () =>
      SkillAssociation.countDocuments({ sourceType: "certification", sourceId: certificationId })
    ),
    0
  );
  await agentA.get(base()).expect(404);
});
