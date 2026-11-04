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
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "education-uploads-"));

let mongoServer;
const userIdA = new mongoose.Types.ObjectId().toString();
let app;
let agentA;
let agentB;
let educationId;

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

test("unauthenticated users cannot access education", async () => {
  await request(app).get("/api/educations").expect(401);
});

test("User A can create, read, update and list education", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({
      institution: "Example University",
      degree: "Master of Science",
      fieldOfStudy: "Computer Science",
      startMonth: 1,
      startYear: 2024,
      endMonth: 12,
      endYear: 2025,
      grade: "3.8/4.0"
    })
    .expect(201);

  educationId = created.body.education._id;

  await agentA
    .patch(`/api/educations/${educationId}`)
    .send({ grade: "3.9/4.0" })
    .expect(200);

  const read = await agentA.get(`/api/educations/${educationId}`).expect(200);
  assert.equal(read.body.education.grade, "3.9/4.0");

  await agentA
    .post("/api/educations")
    .send({
      institution: "Second College",
      degree: "Bachelor of Technology",
      startYear: 2018,
      endYear: 2022
    })
    .expect(201);

  const list = await agentA.get("/api/educations").expect(200);
  assert.deepEqual(
    list.body.educations.map((item) => item.institution),
    ["Example University", "Second College"]
  );
});

test("education validation rejects bad input", async () => {
  await agentA
    .post("/api/educations")
    .send({ institution: "", degree: "BS" })
    .expect(400);

  await agentA
    .post("/api/educations")
    .send({ institution: "X", degree: "BS", startYear: 2025, endYear: 2024 })
    .expect(400);

  await agentA
    .post("/api/educations")
    .send({ institution: "X", degree: "BS", endMonth: 5 })
    .expect(400);
});

test("current education has no end date", async () => {
  const response = await agentA
    .post("/api/educations")
    .send({
      institution: "Current School",
      degree: "PhD",
      startYear: 2025,
      currentlyStudying: true,
      endYear: 2029
    })
    .expect(201);

  assert.equal(response.body.education.endYear, null);
});

test("User B cannot see or change User A's education", async () => {
  const list = await agentB.get("/api/educations").expect(200);
  assert.equal(list.body.educations.length, 0);

  await agentB.get(`/api/educations/${educationId}`).expect(404);
  await agentB
    .patch(`/api/educations/${educationId}`)
    .send({ degree: "Hijacked" })
    .expect(404);
  await agentB.delete(`/api/educations/${educationId}`).expect(404);
});

test("User A can delete one education and keep the others", async () => {
  await agentA.delete(`/api/educations/${educationId}`).expect(200);
  await agentA.get(`/api/educations/${educationId}`).expect(404);

  const list = await agentA.get("/api/educations").expect(200);
  assert.equal(list.body.educations.length, 2);
});

test("education tasks: CRUD, ordering, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Task University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/tasks`;

  await request(app).get(endpoint).expect(401);

  await agentA.post(endpoint).send({ description: "Research", order: 2 }).expect(201);
  const lab = await agentA
    .post(endpoint)
    .send({ description: "Lab work", order: 1 })
    .expect(201);
  await agentA.post(endpoint).send({ description: "Coursework" }).expect(201);

  await agentA.post(endpoint).send({ description: "  " }).expect(400);
  await agentA.post(endpoint).send({ description: "Bad", order: -1 }).expect(400);

  await agentA
    .patch(`${endpoint}/${lab.body.task._id}`)
    .send({ description: "Laboratory work" })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.tasks.map((task) => task.description),
    ["Coursework", "Laboratory work", "Research"]
  );

  await agentB.get(endpoint).expect(404);
  await agentB.post(endpoint).send({ description: "Hijack" }).expect(404);
  await agentB.delete(`${endpoint}/${lab.body.task._id}`).expect(404);

  await agentA.delete(`${endpoint}/${lab.body.task._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.tasks.length, 2);

  // Deleting the education deletes its tasks with it
  await agentA.delete(`/api/educations/${id}`).expect(200);
  const Education = require("../models/Education");
  assert.equal(await runAsUser(userIdA, () => Education.findById(id)), null);
  await agentA.get(endpoint).expect(404);
});

test("education skills: CRUD, duplicates, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Skill University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/skills`;

  await request(app).get(endpoint).expect(401);

  const python = await agentA
    .post(endpoint)
    .send({ name: "Python", category: "Programming", proficiency: "Advanced" })
    .expect(201);
  const ml = await agentA
    .post(endpoint)
    .send({ name: "Machine Learning", order: 1 })
    .expect(201);

  await agentA.post(endpoint).send({ name: "python" }).expect(409);
  await agentA
    .patch(`${endpoint}/${ml.body.skill._id}`)
    .send({ name: "PYTHON" })
    .expect(409);
  await agentA.post(endpoint).send({ name: "SQL", proficiency: "Guru" }).expect(400);

  await agentA
    .patch(`${endpoint}/${ml.body.skill._id}`)
    .send({ category: "AI/ML", proficiency: "Intermediate" })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.skills.map((skill) => `${skill.name}|${skill.category}|${skill.proficiency}`),
    ["Python|Programming|Advanced", "Machine Learning|AI/ML|Intermediate"]
  );

  await agentB.get(endpoint).expect(404);
  await agentB.delete(`${endpoint}/${python.body.skill._id}`).expect(404);

  await agentA.delete(`${endpoint}/${python.body.skill._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.skills.length, 1);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(endpoint).expect(404);
});

test("education achievements: CRUD, validation, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Award University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/achievements`;

  await request(app).get(endpoint).expect(401);

  const honor = await agentA
    .post(endpoint)
    .send({
      title: "Dean's List",
      type: "Achievement",
      date: "2024-05-15",
      issuedBy: "Award University",
      url: "https://example.com/deans-list"
    })
    .expect(201);

  assert.equal(honor.body.achievement.date.slice(0, 10), "2024-05-15");

  await agentA
    .post(endpoint)
    .send({ title: "Robotics Club", type: "Activity" })
    .expect(201);
  await agentA
    .post(endpoint)
    .send({ title: "Hackathon", type: "Competition", date: "2025-01-10" })
    .expect(201);

  // Invalid input
  await agentA.post(endpoint).send({ title: "" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", type: "Trophy" }).expect(400);
  // Honors and certifications have their own section now
  await agentA.post(endpoint).send({ title: "X", type: "Honor" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", date: "2024-02-30" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", date: "05/15/2024" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", url: "ftp://example.com" }).expect(400);
  await agentA
    .post(endpoint)
    .send({ title: "X", url: "https://user:pass@example.com" })
    .expect(400);

  // Partial update keeps the other fields; date can be cleared
  await agentA
    .patch(`${endpoint}/${honor.body.achievement._id}`)
    .send({ description: "Top 5% of class", date: null })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);

  // Dated entries first (newest date first), then undated
  assert.equal(list.body.achievements[0].title, "Hackathon");
  const updated = list.body.achievements.find((item) => item.title === "Dean's List");
  assert.equal(updated.description, "Top 5% of class");
  assert.equal(updated.date, null);
  assert.equal(updated.issuedBy, "Award University");

  await agentB.get(endpoint).expect(404);
  await agentB
    .patch(`${endpoint}/${honor.body.achievement._id}`)
    .send({ title: "Hijacked" })
    .expect(404);

  await agentA.delete(`${endpoint}/${honor.body.achievement._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.achievements.length, 2);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(endpoint).expect(404);
});

test("education volunteering: CRUD, validation, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Volunteer University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/volunteering`;

  await request(app).get(endpoint).expect(401);

  const past = await agentA
    .post(endpoint)
    .send({
      organization: "Food Bank",
      role: "Volunteer",
      cause: "Community",
      startMonth: 1,
      startYear: 2023,
      endMonth: 6,
      endYear: 2023,
      url: "https://example.org/food-bank"
    })
    .expect(201);

  await agentA
    .post(endpoint)
    .send({ organization: "Code Club", role: "Mentor", startYear: 2024 })
    .expect(201);

  // Invalid input
  await agentA.post(endpoint).send({ organization: "", role: "X" }).expect(400);
  await agentA
    .post(endpoint)
    .send({ organization: "X", role: "Y", startYear: 2024, endYear: 2023 })
    .expect(400);
  await agentA
    .post(endpoint)
    .send({ organization: "X", role: "Y", endMonth: 3 })
    .expect(400);
  await agentA
    .post(endpoint)
    .send({ organization: "X", role: "Y", url: "javascript:alert(1)" })
    .expect(400);
  await agentA
    .post(endpoint)
    .send({ organization: "X", role: "Y", url: "https://user:pass@example.org" })
    .expect(400);

  // Marking as ongoing clears the end date
  const ongoing = await agentA
    .patch(`${endpoint}/${past.body.volunteering._id}`)
    .send({ currentlyVolunteering: true, role: "Coordinator" })
    .expect(200);

  assert.equal(ongoing.body.volunteering.endYear, null);
  assert.equal(ongoing.body.volunteering.endMonth, null);
  assert.equal(ongoing.body.volunteering.cause, "Community");

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.volunteering.map((item) => item.organization),
    ["Food Bank", "Code Club"]
  );

  await agentB.get(endpoint).expect(404);
  await agentB.delete(`${endpoint}/${past.body.volunteering._id}`).expect(404);

  await agentA.delete(`${endpoint}/${past.body.volunteering._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.volunteering.length, 1);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(endpoint).expect(404);
});

test("education media: links, files, validation, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Media University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/media`;
  const storedFileExists = (key) =>
    fs.existsSync(path.join(process.env.UPLOAD_DIR, key));

  await request(app).get(endpoint).expect(401);

  const link = await agentA
    .post(endpoint)
    .send({
      title: "Research Poster",
      mediaType: "Presentation",
      url: "https://example.com/poster"
    })
    .expect(201);

  // URL is optional; invalid links and types are refused
  const certificate = await agentA
    .post(endpoint)
    .send({ title: "Degree Certificate", mediaType: "Certificate" })
    .expect(201);
  await agentA.post(endpoint).send({ title: "" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", mediaType: "Song" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", url: "javascript:alert(1)" }).expect(400);
  await agentA
    .post(endpoint)
    .send({ title: "X", url: "https://user:pass@example.com" })
    .expect(400);

  await agentA
    .patch(`${endpoint}/${link.body.media._id}`)
    .send({ description: "Presented at the symposium" })
    .expect(200);

  // Attach a PDF, view it, and refuse non-PDF content
  const pdf = Buffer.from("%PDF-1.4\n% certificate\n%%EOF\n");
  const uploaded = await agentA
    .post(`${endpoint}/${certificate.body.media._id}/file`)
    .attach("file", pdf, "certificate.pdf")
    .expect(200);

  const key = uploaded.body.media.file.key;
  assert.ok(storedFileExists(key));

  await agentA
    .post(`${endpoint}/${certificate.body.media._id}/file`)
    .attach("file", Buffer.from("MZ not a pdf"), "fake.pdf")
    .expect(400);

  const view = await agentA
    .get(`${endpoint}/${certificate.body.media._id}/file`)
    .expect(200);
  assert.equal(view.headers["content-type"], "application/pdf");

  // Another user cannot list, view or delete
  await agentB.get(endpoint).expect(404);
  await agentB.get(`${endpoint}/${certificate.body.media._id}/file`).expect(404);
  await agentB.delete(`${endpoint}/${link.body.media._id}`).expect(404);

  // Deleting a media item removes it; deleting the education removes the file
  await agentA.delete(`${endpoint}/${link.body.media._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.media.length, 1);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  assert.equal(storedFileExists(key), false);
  await agentA.get(endpoint).expect(404);
});

test("education projects: CRUD, dates, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({
      institution: "Project University",
      degree: "MS",
      startMonth: 1,
      startYear: 2022,
      endMonth: 12,
      endYear: 2023
    })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/projects`;

  await request(app).get(endpoint).expect(401);

  const first = await agentA
    .post(endpoint)
    .send({
      title: "Recommendation System",
      description: "Collaborative filtering",
      startMonth: 3,
      startYear: 2022,
      endMonth: 8,
      endYear: 2022
    })
    .expect(201);

  assert.equal(first.body.project.status, "Planned");

  const second = await agentA
    .post(endpoint)
    .send({ title: "ML Pipeline", status: "In Progress" })
    .expect(201);

  // Validation, including dates within the education and not in the future
  await agentA.post(endpoint).send({ title: "" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", status: "Done" }).expect(400);
  await agentA
    .post(endpoint)
    .send({ title: "X", startYear: 2023, endYear: 2022 })
    .expect(400);
  const early = await agentA
    .post(endpoint)
    .send({ title: "X", startMonth: 12, startYear: 2021 })
    .expect(400);
  assert.match(early.body.message, /within this education's dates \(Jan 2022 – Dec 2023\)/);
  await agentA
    .post(endpoint)
    .send({ title: "X", endYear: 2024 })
    .expect(400);

  await agentA
    .patch(`${endpoint}/${first.body.project._id}`)
    .send({ status: "Completed" })
    .expect(200);

  const read = await agentA
    .get(`${endpoint}/${first.body.project._id}`)
    .expect(200);
  assert.equal(read.body.project.status, "Completed");
  assert.equal(read.body.project.description, "Collaborative filtering");

  assert.equal((await agentA.get(endpoint).expect(200)).body.projects.length, 2);

  await agentB.get(endpoint).expect(404);
  await agentB.get(`${endpoint}/${first.body.project._id}`).expect(404);
  await agentB.delete(`${endpoint}/${first.body.project._id}`).expect(404);

  await agentA.delete(`${endpoint}/${second.body.project._id}`).expect(200);
  await agentA.get(`${endpoint}/${second.body.project._id}`).expect(404);
  assert.equal((await agentA.get(endpoint).expect(200)).body.projects.length, 1);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(endpoint).expect(404);
});

test("education project tasks: CRUD, order, isolation, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Project Task University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const projectA = (await agentA
    .post(`/api/educations/${id}/projects`)
    .send({ title: "Project A" })
    .expect(201)).body.project._id;
  const projectB = (await agentA
    .post(`/api/educations/${id}/projects`)
    .send({ title: "Project B" })
    .expect(201)).body.project._id;

  const endpoint = `/api/educations/${id}/projects/${projectA}/tasks`;

  await request(app).get(endpoint).expect(401);

  await agentA.post(endpoint).send({ description: "Deployment", order: 3 }).expect(201);
  const model = await agentA
    .post(endpoint)
    .send({ description: "Model development", order: 1 })
    .expect(201);
  await agentA.post(endpoint).send({ description: "Data collection", order: 0 }).expect(201);

  await agentA.post(endpoint).send({ description: "" }).expect(400);
  await agentA.post(endpoint).send({ description: "X", order: -2 }).expect(400);

  await agentA
    .patch(`${endpoint}/${model.body.task._id}`)
    .send({ description: "Model training", order: 2 })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.tasks.map((task) => task.description),
    ["Data collection", "Model training", "Deployment"]
  );

  // Tasks belong only to their project
  const other = await agentA
    .get(`/api/educations/${id}/projects/${projectB}/tasks`)
    .expect(200);
  assert.equal(other.body.tasks.length, 0);
  await agentA
    .patch(`/api/educations/${id}/projects/${projectB}/tasks/${model.body.task._id}`)
    .send({ description: "Moved" })
    .expect(404);

  // Another user cannot read or change them
  await agentB.get(endpoint).expect(404);
  await agentB.delete(`${endpoint}/${model.body.task._id}`).expect(404);

  await agentA.delete(`${endpoint}/${model.body.task._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.tasks.length, 2);

  // Deleting the project removes its tasks; deleting the education removes the rest
  await agentA.delete(`/api/educations/${id}/projects/${projectA}`).expect(200);
  await agentA.get(endpoint).expect(404);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(`/api/educations/${id}/projects/${projectB}/tasks`).expect(404);
});

test("education project contributors, skills and media", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Full Project University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const projectA = (await agentA
    .post(`/api/educations/${id}/projects`)
    .send({ title: "Project A" })
    .expect(201)).body.project._id;
  const projectB = (await agentA
    .post(`/api/educations/${id}/projects`)
    .send({ title: "Project B" })
    .expect(201)).body.project._id;

  const base = (projectId) => `/api/educations/${id}/projects/${projectId}`;
  const storedFileExists = (key) =>
    fs.existsSync(path.join(process.env.UPLOAD_DIR, key));

  // Contributors
  const contributor = await agentA
    .post(`${base(projectA)}/contributors`)
    .send({ name: "Alex", role: "Researcher", email: "Alex@Example.com" })
    .expect(201);
  assert.equal(contributor.body.contributor.email, "alex@example.com");
  await agentA
    .post(`${base(projectA)}/contributors`)
    .send({ name: "Bad", role: "QA", email: "nope" })
    .expect(400);
  await agentA
    .patch(`${base(projectA)}/contributors/${contributor.body.contributor._id}`)
    .send({ role: "Lead Researcher" })
    .expect(200);

  // Skills: duplicates blocked per project, allowed in another project
  await agentA.post(`${base(projectA)}/skills`).send({ name: "Python" }).expect(201);
  await agentA.post(`${base(projectA)}/skills`).send({ name: "python" }).expect(409);
  await agentA.post(`${base(projectB)}/skills`).send({ name: "Python" }).expect(201);

  // Media: link and file upload / download
  await agentA
    .post(`${base(projectA)}/media/links`)
    .send({ title: "Repo", url: "https://github.com/example/repo" })
    .expect(201);

  const pdf = Buffer.from("%PDF-1.4\n% report\n%%EOF\n");
  const uploaded = await agentA
    .post(`${base(projectA)}/media/upload`)
    .field("title", "Final Report")
    .attach("file", pdf, "report.pdf")
    .expect(201);

  const key = uploaded.body.media.file.key;
  assert.match(key, /^education-project-media\//);
  assert.ok(storedFileExists(key));

  const download = await agentA
    .get(`${base(projectA)}/media/${uploaded.body.media._id}/download`)
    .expect(200);
  assert.match(download.headers["content-disposition"], /report\.pdf/);

  await agentA
    .post(`${base(projectA)}/media/upload`)
    .field("title", "Fake")
    .attach("file", Buffer.from("MZ not a pdf"), "fake.pdf")
    .expect(400);

  // Another user is blocked everywhere
  await agentB.get(`${base(projectA)}/contributors`).expect(404);
  await agentB.get(`${base(projectA)}/skills`).expect(404);
  await agentB.get(`${base(projectA)}/media`).expect(404);
  await agentB
    .get(`${base(projectA)}/media/${uploaded.body.media._id}/download`)
    .expect(404);

  const lists = await Promise.all(
    ["contributors", "skills", "media"].map((section) =>
      agentA.get(`${base(projectA)}/${section}`).expect(200)
    )
  );
  assert.deepEqual(
    lists.map((response, index) =>
      response.body[["contributors", "skills", "media"][index]].length
    ),
    [1, 1, 2]
  );

  // Deleting the project removes its contents and files; the other stays
  await agentA.delete(base(projectA)).expect(200);
  assert.equal(storedFileExists(key), false);
  await agentA.get(`${base(projectA)}/contributors`).expect(404);
  await agentA.get(`${base(projectB)}/skills`).expect(200);

  // Deleting the education removes project files too
  const second = await agentA
    .post(`${base(projectB)}/media/upload`)
    .field("title", "Poster")
    .attach("file", pdf, "poster.pdf")
    .expect(201);
  await agentA.delete(`/api/educations/${id}`).expect(200);
  assert.equal(storedFileExists(second.body.media.file.key), false);
});

test("education courses: CRUD, duplicate IDs, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Course University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/courses`;

  await request(app).get(endpoint).expect(401);

  const python = await agentA
    .post(endpoint)
    .send({ name: "Python Programming", code: "CS 5590" })
    .expect(201);
  await agentA
    .post(endpoint)
    .send({ name: "Machine Learning", code: "CS 5565", order: 1 })
    .expect(201);
  // Course ID is optional
  await agentA.post(endpoint).send({ name: "Seminar" }).expect(201);
  await agentA.post(endpoint).send({ name: "Another Seminar" }).expect(201);

  // Same ID ignoring case/spaces is a duplicate; name is required
  await agentA.post(endpoint).send({ name: "Dup", code: "cs5590" }).expect(409);
  await agentA.post(endpoint).send({ name: "", code: "X1" }).expect(400);
  await agentA
    .post(endpoint)
    .send({ name: "Long", code: "X".repeat(51) })
    .expect(400);

  await agentA
    .patch(`${endpoint}/${python.body.course._id}`)
    .send({ name: "Python for Data Science" })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.courses.map((course) => `${course.code}|${course.name}`),
    [
      "CS 5590|Python for Data Science",
      "|Seminar",
      "|Another Seminar",
      "CS 5565|Machine Learning"
    ]
  );

  await agentB.get(endpoint).expect(404);
  await agentB.delete(`${endpoint}/${python.body.course._id}`).expect(404);

  await agentA.delete(`${endpoint}/${python.body.course._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.courses.length, 3);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(endpoint).expect(404);
});

test("education certifications & honors: CRUD, types, ownership and cascade", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Honors University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const endpoint = `/api/educations/${id}/certifications`;

  await request(app).get(endpoint).expect(401);

  const cert = await agentA
    .post(endpoint)
    .send({ title: "Data Science Certificate", issuedBy: "Honors University", date: "2024-05-01" })
    .expect(201);
  assert.equal(cert.body.certification.type, "Certification");

  await agentA
    .post(endpoint)
    .send({ title: "Merit Scholarship", type: "Scholarship" })
    .expect(201);
  await agentA
    .post(endpoint)
    .send({ title: "Summa Cum Laude", type: "Honor", date: "2025-05-20" })
    .expect(201);

  await agentA.post(endpoint).send({ title: "X", type: "Leadership" }).expect(400);
  await agentA.post(endpoint).send({ title: "" }).expect(400);
  await agentA.post(endpoint).send({ title: "X", date: "2024-13-01" }).expect(400);

  await agentA
    .patch(`${endpoint}/${cert.body.certification._id}`)
    .send({ url: "https://example.com/cert" })
    .expect(200);

  const list = await agentA.get(endpoint).expect(200);
  assert.deepEqual(
    list.body.certifications.map((item) => item.title),
    ["Summa Cum Laude", "Data Science Certificate", "Merit Scholarship"]
  );

  // Separate from Activities & Achievements
  const achievements = await agentA.get(`/api/educations/${id}/achievements`).expect(200);
  assert.equal(achievements.body.achievements.length, 0);

  await agentB.get(endpoint).expect(404);
  await agentB.delete(`${endpoint}/${cert.body.certification._id}`).expect(404);

  await agentA.delete(`${endpoint}/${cert.body.certification._id}`).expect(200);
  assert.equal((await agentA.get(endpoint).expect(200)).body.certifications.length, 2);

  await agentA.delete(`/api/educations/${id}`).expect(200);
  await agentA.get(endpoint).expect(404);
});

test("education achievements, certifications and volunteering accept file attachments", async () => {
  const created = await agentA
    .post("/api/educations")
    .send({ institution: "Attachment University", degree: "MS" })
    .expect(201);

  const id = created.body.education._id;
  const pdf = Buffer.from("%PDF-1.4\n% attachment\n%%EOF\n");
  const storedFileExists = (key) =>
    fs.existsSync(path.join(process.env.UPLOAD_DIR, key));

  const sections = [
    ["achievements", "achievement", { title: "Hackathon Winner", type: "Competition" }],
    ["certifications", "certification", { title: "Dean's List", type: "Honor" }],
    ["volunteering", "volunteering", { organization: "Food Bank", role: "Volunteer" }]
  ];

  const keys = [];

  for (const [section, itemKey, body] of sections) {
    const endpoint = `/api/educations/${id}/${section}`;
    const item = (await agentA.post(endpoint).send(body).expect(201)).body[itemKey];

    const uploaded = await agentA
      .post(`${endpoint}/${item._id}/file`)
      .attach("file", pdf, `${section}.pdf`)
      .expect(200);

    const key = uploaded.body[itemKey].file.key;
    assert.match(key, new RegExp(`^education-${section}/`));
    assert.ok(storedFileExists(key));
    keys.push(key);

    // Viewable by the owner only; non-PDF content refused
    await agentA.get(`${endpoint}/${item._id}/file`).expect(200);
    await agentB.get(`${endpoint}/${item._id}/file`).expect(404);
    await agentA
      .post(`${endpoint}/${item._id}/file`)
      .attach("file", Buffer.from("MZ not a pdf"), "fake.pdf")
      .expect(400);
  }

  // Removing the file keeps the item
  const achievements = await agentA.get(`/api/educations/${id}/achievements`).expect(200);
  const achievementId = achievements.body.achievements[0]._id;
  const removed = await agentA
    .delete(`/api/educations/${id}/achievements/${achievementId}/file`)
    .expect(200);
  assert.equal(removed.body.achievement.file, null);
  assert.equal(storedFileExists(keys[0]), false);

  // Deleting an item deletes its file
  const volunteering = await agentA.get(`/api/educations/${id}/volunteering`).expect(200);
  await agentA
    .delete(`/api/educations/${id}/volunteering/${volunteering.body.volunteering[0]._id}`)
    .expect(200);
  assert.equal(storedFileExists(keys[2]), false);

  // Deleting the education deletes the remaining file
  assert.ok(storedFileExists(keys[1]));
  await agentA.delete(`/api/educations/${id}`).expect(200);
  assert.equal(storedFileExists(keys[1]), false);
});

test("education enforces item and text limits", async () => {
  const { body } = await agentA
    .post("/api/educations")
    .send({ institution: "Limits University", degree: "BSc" })
    .expect(201);
  const base = `/api/educations/${body.education._id}`;

  await agentA
    .patch(base)
    .send({ description: "x".repeat(2201) })
    .expect(400);

  for (let i = 0; i < 10; i++) {
    await agentA.post(`${base}/skills`).send({ name: `Skill ${i}` }).expect(201);
  }
  const full = await agentA.post(`${base}/skills`).send({ name: "Skill 11" }).expect(400);
  assert.match(full.body.message, /up to 10/);

  for (let i = 0; i < 5; i++) {
    await agentA.post(`${base}/achievements`).send({ title: `Award ${i}` }).expect(201);
  }
  await agentA.post(`${base}/achievements`).send({ title: "Award 6" }).expect(400);

  // Certifications have no limit
  for (let i = 0; i < 6; i++) {
    await agentA.post(`${base}/certifications`).send({ title: `Cert ${i}` }).expect(201);
  }
});
