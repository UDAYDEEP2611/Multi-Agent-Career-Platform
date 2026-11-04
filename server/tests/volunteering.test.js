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
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "volunteering-uploads-"));

const pdfBuffer = Buffer.from("%PDF-1.4\n% integration test file\n%%EOF\n");

let mongoServer;
let app;
let agentA;
let agentB;
let volunteeringId;

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
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

const base = (id = volunteeringId) => `/api/volunteering/${id}`;

test("volunteering requires sign-in", async () => {
  await request(app).get("/api/volunteering").expect(401);
});

test("volunteering roles can be created, listed, updated and validated", async () => {
  const created = await agentA.post("/api/volunteering").send({
    organization: "  Example Shelter ",
    role: "Fundraising Volunteer",
    cause: "Animal Welfare",
    currentlyVolunteering: true,
    startMonth: 6,
    startYear: 2022,
    endYear: 2023,
    description: "Organized events."
  }).expect(201);

  volunteeringId = created.body.volunteering._id;
  assert.equal(created.body.volunteering.organization, "Example Shelter");
  // Current roles drop the end date
  assert.equal(created.body.volunteering.endYear, null);

  await agentA.post("/api/volunteering").send({
    organization: "Old Org", role: "Helper", startYear: 2015, endYear: 2016
  }).expect(201);

  const list = await agentA.get("/api/volunteering").expect(200);
  assert.deepEqual(
    list.body.volunteering.map((item) => item.organization),
    ["Example Shelter", "Old Org"]
  );

  const nextYear = new Date().getFullYear() + 1;
  const valid = { organization: "Org", role: "Role" };
  const invalid = [
    [{ role: "Role" }, /Organization is required/],
    [{ organization: "Org" }, /Role is required/],
    [{ ...valid, cause: "Gardening" }, /Invalid cause/],
    [{ ...valid, startYear: nextYear }, /future/],
    [{ ...valid, startYear: 2022, endYear: 2021 }, /earlier than start/],
    [{ ...valid, endMonth: 4 }, /End year is required/],
    [{ ...valid, description: "x".repeat(2001) }, /at most 2000/],
    [{ ...valid, userId: "x" }, /Unsupported field/]
  ];

  for (const [body, message] of invalid) {
    const response = await agentA.post("/api/volunteering").send(body).expect(400);
    assert.match(response.body.message, message);
  }

  const updated = await agentA.patch(base()).send({
    currentlyVolunteering: false, endMonth: 1, endYear: 2024
  }).expect(200);
  assert.equal(updated.body.volunteering.endYear, 2024);
  assert.equal(updated.body.volunteering.role, "Fundraising Volunteer");
});

test("other users cannot see or change a volunteering role", async () => {
  await agentB.get(base()).expect(404);
  await agentB.patch(base()).send({ role: "Taken" }).expect(404);
  await agentB.get(`${base()}/media`).expect(404);
  await agentB.delete(base()).expect(404);
});

test("media uploads work and deleting the role removes its files", async () => {
  const upload = await agentA
    .post(`${base()}/media/upload`)
    .field("title", "Event photo")
    .attach("file", pdfBuffer, { filename: "event.pdf", contentType: "application/pdf" })
    .expect(201);

  const key = upload.body.media.file.key;
  assert.match(key, /^volunteering-media\//);
  assert.ok(storedFileExists(key));

  await agentA.delete(base()).expect(200);
  assert.equal(storedFileExists(key), false);
  await agentA.get(base()).expect(404);
});
