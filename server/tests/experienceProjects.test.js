const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const JSZip = require("jszip");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { runAsUser } = require("../utils/userDatabase");

// Runs against an in-memory MongoDB and a temporary upload folder,
// so the real database and server/uploads are never touched.
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-uploads-"));

let mongoServer;
const userIdA = new mongoose.Types.ObjectId().toString();
let app;
let agentA;
let agentB;

let experienceA;
let projectA;
let projectB;
let uploadedFile;

const projectsPath = (experienceId) =>
  `/api/experiences/${experienceId}/projects`;

const childPath = (experienceId, projectId, child) =>
  `${projectsPath(experienceId)}/${projectId}/${child}`;

const storedFileExists = (key) =>
  fs.existsSync(path.join(process.env.UPLOAD_DIR, key));

const pdfBuffer = Buffer.from("%PDF-1.4\n% integration test file\n%%EOF\n");

async function docxBuffer() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", "<document/>");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createExperience(agent, organization) {
  const response = await agent
    .post("/api/experiences")
    .send({
      jobTitle: "Software Engineer",
      organization,
      startYear: 2025,
      currentlyWorking: true
    })
    .expect(201);

  return response.body.experience._id;
}

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

  await agentA
    .post("/__test/login")
    .send({ userId: userIdA })
    .expect(200);

  await agentB
    .post("/__test/login")
    .send({ userId: new mongoose.Types.ObjectId().toString() })
    .expect(200);

  experienceA = await createExperience(agentA, "Test Organization");
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test("test login route cannot be enabled outside test mode", () => {
  const createApp = require("../app");
  const previous = process.env.NODE_ENV;

  process.env.NODE_ENV = "development";

  try {
    assert.throws(
      () => createApp({
        enableTestAuth: true,
        sessionStore: new session.MemoryStore()
      }),
      /only allowed in test mode/
    );
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test("unauthenticated users cannot access projects", async () => {
  await request(app).get(projectsPath(experienceA)).expect(401);
  await request(app).get("/api/experiences").expect(401);
});

test("User A can create, read and update a project", async () => {
  const created = await agentA
    .post(projectsPath(experienceA))
    .send({
      title: "AI Research Platform",
      description: "Project integration test",
      status: "In Progress",
      startMonth: 1,
      startYear: 2025
    })
    .expect(201);

  projectA = created.body.project._id;
  assert.equal(created.body.project.title, "AI Research Platform");

  await agentA
    .patch(`${projectsPath(experienceA)}/${projectA}`)
    .send({ status: "Completed" })
    .expect(200);

  const read = await agentA
    .get(`${projectsPath(experienceA)}/${projectA}`)
    .expect(200);

  assert.equal(read.body.project.status, "Completed");

  const second = await agentA
    .post(projectsPath(experienceA))
    .send({ title: "Second Project" })
    .expect(201);

  projectB = second.body.project._id;

  const list = await agentA.get(projectsPath(experienceA)).expect(200);
  assert.equal(list.body.projects.length, 2);
});

test("project validation rejects bad input", async () => {
  await agentA
    .post(projectsPath(experienceA))
    .send({ title: "" })
    .expect(400);

  await agentA
    .post(projectsPath(experienceA))
    .send({ title: "Bad dates", startYear: 2025, endYear: 2024 })
    .expect(400);

  await agentA
    .post(projectsPath(experienceA))
    .send({ title: "Bad status", status: "Finished" })
    .expect(400);
});

test("User B cannot see or change User A's experience or project", async () => {
  const list = await agentB.get("/api/experiences").expect(200);
  assert.equal(list.body.experiences.length, 0);

  await agentB.get(projectsPath(experienceA)).expect(404);
  await agentB.get(`${projectsPath(experienceA)}/${projectA}`).expect(404);
  await agentB
    .patch(`${projectsPath(experienceA)}/${projectA}`)
    .send({ title: "Hijacked" })
    .expect(404);
  await agentB.delete(`${projectsPath(experienceA)}/${projectA}`).expect(404);
  await agentB
    .post(childPath(experienceA, projectA, "tasks"))
    .send({ description: "Unauthorized task" })
    .expect(404);
  await agentB.get(childPath(experienceA, projectA, "media")).expect(404);
});

test("a project ID under another experience is not found", async () => {
  const otherExperience = await createExperience(agentA, "Other Organization");

  await agentA
    .get(`${projectsPath(otherExperience)}/${projectA}`)
    .expect(404);

  await agentA
    .get(childPath(otherExperience, projectA, "tasks"))
    .expect(404);
});

test("User A can create, edit and delete project tasks", async () => {
  const endpoint = childPath(experienceA, projectA, "tasks");

  await agentA.post(endpoint).send({ description: "Build API endpoints" }).expect(201);
  const second = await agentA
    .post(endpoint)
    .send({ description: "Develop React components" })
    .expect(201);

  await agentA
    .patch(`${endpoint}/${second.body.task._id}`)
    .send({ description: "Develop React pages" })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.tasks.map((task) => task.description),
    ["Build API endpoints", "Develop React pages"]
  );

  // Tasks are per project
  const other = await agentA
    .get(childPath(experienceA, projectB, "tasks"))
    .expect(200);
  assert.equal(other.body.tasks.length, 0);

  await agentA.post(endpoint).send({ description: "   " }).expect(400);
});

test("User A can add contributors; invalid email is rejected", async () => {
  const endpoint = childPath(experienceA, projectA, "contributors");

  const response = await agentA
    .post(endpoint)
    .send({
      name: "Test Contributor",
      role: "Backend Developer",
      contribution: "Implemented APIs",
      email: "Person@Example.com"
    })
    .expect(201);

  assert.equal(response.body.contributor.role, "Backend Developer");
  assert.equal(response.body.contributor.email, "person@example.com");

  await agentA
    .post(endpoint)
    .send({ name: "Bad Email", role: "QA", email: "not-an-email" })
    .expect(400);
});

test("duplicate project skills are rejected, but allowed in another project", async () => {
  const endpoint = childPath(experienceA, projectA, "skills");

  await agentA.post(endpoint).send({ name: "Python" }).expect(201);
  await agentA.post(endpoint).send({ name: "python" }).expect(409);

  await agentA
    .post(childPath(experienceA, projectB, "skills"))
    .send({ name: "Python" })
    .expect(201);
});

test("User A can add a media link; non-http links are rejected", async () => {
  const endpoint = `${childPath(experienceA, projectA, "media")}/links`;

  const response = await agentA
    .post(endpoint)
    .send({
      title: "GitHub Repository",
      url: "https://github.com/example/repository"
    })
    .expect(201);

  assert.equal(response.body.media.mediaType, "Link");

  await agentA
    .post(endpoint)
    .send({ title: "Script", url: "javascript:alert(1)" })
    .expect(400);
});

test("User A can upload PDF and DOCX files and download them", async () => {
  const endpoint = `${childPath(experienceA, projectA, "media")}/upload`;

  const pdf = await agentA
    .post(endpoint)
    .field("title", "Design document")
    .attach("file", pdfBuffer, "design.pdf")
    .expect(201);

  uploadedFile = pdf.body.media;
  assert.equal(uploadedFile.file.mimeType, "application/pdf");
  assert.ok(storedFileExists(uploadedFile.file.key));

  const docx = await agentA
    .post(endpoint)
    .field("title", "Report")
    .attach("file", await docxBuffer(), "report.docx")
    .expect(201);

  assert.equal(
    docx.body.media.file.mimeType,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

  const download = await agentA
    .get(`${childPath(experienceA, projectA, "media")}/${uploadedFile._id}/download`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);

  assert.match(download.headers["content-disposition"], /design\.pdf/);
  assert.deepEqual(download.body, pdfBuffer);
});

test("unsafe or oversized uploads are rejected", async () => {
  const endpoint = `${childPath(experienceA, projectA, "media")}/upload`;
  const exe = Buffer.from("MZ\x90\x00 this is an executable");

  await agentA
    .post(endpoint)
    .field("title", "Program")
    .attach("file", exe, "program.exe")
    .expect(400);

  // Renamed executable is caught by the content check
  await agentA
    .post(endpoint)
    .field("title", "Fake PDF")
    .attach("file", exe, "fake.pdf")
    .expect(400);

  // A plain ZIP is not a DOCX
  const zip = new JSZip();
  zip.file("readme.txt", "hello");
  await agentA
    .post(endpoint)
    .field("title", "Fake DOCX")
    .attach("file", await zip.generateAsync({ type: "nodebuffer" }), "fake.docx")
    .expect(400);

  const tooLarge = Buffer.alloc(12 * 1024 * 1024);
  pdfBuffer.copy(tooLarge);
  await agentA
    .post(endpoint)
    .field("title", "Huge")
    .attach("file", tooLarge, "huge.pdf")
    .expect(400);
});

test("User B cannot download User A's file", async () => {
  await agentB
    .get(`${childPath(experienceA, projectA, "media")}/${uploadedFile._id}/download`)
    .expect(404);
});

test("deleting a project removes its child records and files", async () => {
  await agentA.delete(`${projectsPath(experienceA)}/${projectA}`).expect(200);

  const Experience = require("../models/Experience");
  const experience = await runAsUser(userIdA, () => Experience.findById(experienceA));

  assert.equal(experience.projects.id(projectA), null);
  assert.ok(experience.projects.id(projectB), "other project is kept");
  assert.equal(storedFileExists(uploadedFile.file.key), false);
});

test("deleting an experience removes its projects and files", async () => {
  const media = await agentA
    .post(`${childPath(experienceA, projectB, "media")}/upload`)
    .field("title", "Kept until experience delete")
    .attach("file", pdfBuffer, "notes.pdf")
    .expect(201);

  const key = media.body.media.file.key;
  assert.ok(storedFileExists(key));

  await agentA.delete(`/api/experiences/${experienceA}`).expect(200);

  const Experience = require("../models/Experience");
  assert.equal(await runAsUser(userIdA, () => Experience.findById(experienceA)), null);
  assert.equal(storedFileExists(key), false);
});

test("project dates must fall within the experience's dates", async () => {
  const response = await agentA
    .post("/api/experiences")
    .send({
      jobTitle: "Data Engineer",
      organization: "Dated Organization",
      startMonth: 2,
      startYear: 2022,
      endMonth: 6,
      endYear: 2023,
      currentlyWorking: false
    })
    .expect(201);

  const endpoint = projectsPath(response.body.experience._id);

  // Dates are optional
  await agentA.post(endpoint).send({ title: "No dates" }).expect(201);

  // Inside the job's dates, including a year-only date
  await agentA
    .post(endpoint)
    .send({ title: "Inside", startMonth: 2, startYear: 2022, endMonth: 6, endYear: 2023 })
    .expect(201);
  await agentA
    .post(endpoint)
    .send({ title: "Year only", startYear: 2022 })
    .expect(201);

  // Before the job started / after it ended
  const early = await agentA
    .post(endpoint)
    .send({ title: "Too early", startMonth: 1, startYear: 2022 })
    .expect(400);
  assert.match(early.body.message, /Feb 2022 – Jun 2023/);

  await agentA
    .post(endpoint)
    .send({ title: "Too late", startYear: 2022, endMonth: 7, endYear: 2023 })
    .expect(400);

  // Current jobs have no end limit, but still a start limit
  const current = await createExperience(agentA, "Current Organization");

  const thisYear = new Date().getFullYear();

  await agentA
    .post(projectsPath(current))
    .send({ title: "Ongoing", startYear: 2025, endYear: thisYear })
    .expect(201);

  // No future dates, even for current jobs
  const future = await agentA
    .post(projectsPath(current))
    .send({ title: "Future", startYear: 2025, endYear: thisYear + 1 })
    .expect(400);
  assert.match(future.body.message, /can't be in the future/);
  await agentA
    .post(projectsPath(current))
    .send({ title: "Before start", startYear: 2024 })
    .expect(400);
});
