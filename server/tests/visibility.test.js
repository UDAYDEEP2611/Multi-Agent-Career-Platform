const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
// No model and no A2A agent: the resume chat runs on its fallbacks
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9";
process.env.A2A_DESIGNER_URL = "off";

const password = "a-long-test-password";
let mongoServer;
let agent;
let other;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  const app = require("../app")({ sessionStore: new session.MemoryStore() });
  for (const name of ["vis_owner", "vis_other"]) {
    await request(app).post("/api/auth/register").send({ username: name, email: `${name}@example.com`, password, confirmPassword: password }).expect(201);
  }
  agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "vis_owner", password }).expect(200);
  other = request.agent(app);
  await other.post("/api/auth/login").send({ identifier: "vis_other", password }).expect(200);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const showcase = async (audience) => (await agent.get(`/api/portfolio/showcase${audience ? `?for=${audience}` : ""}`).expect(200)).body.portfolio;

test("Show in portfolio and Show in resume decide where an entry appears", async () => {
  const bank = (await agent.post("/api/projects").send({ title: "Blood Bank Management System" }).expect(201)).body.project;
  await agent.post("/api/projects").send({ title: "UltraUnityVerse", description: "Agentic portfolio platform built with LangGraph" }).expect(201);
  assert.equal(bank.showInPortfolio, true);
  assert.equal(bank.showInResume, true);

  // Off for resumes: still on the portfolio, gone from resumes
  let { entry } = (await agent.patch(`/api/visibility/projects/${bank._id}`).send({ showInResume: false }).expect(200)).body;
  assert.deepEqual([entry.showInPortfolio, entry.showInResume], [true, false]);
  assert.deepEqual((await showcase()).projects.map((item) => item.title).sort(), ["Blood Bank Management System", "UltraUnityVerse"]);
  assert.deepEqual((await showcase("resume")).projects.map((item) => item.title), ["UltraUnityVerse"]);

  // Off for the portfolio too
  ({ entry } = (await agent.patch(`/api/visibility/projects/${bank._id}`).send({ showInPortfolio: false }).expect(200)).body);
  assert.deepEqual((await showcase()).projects.map((item) => item.title), ["UltraUnityVerse"]);

  // Skills too
  const skill = (await agent.post("/api/skills").send({ name: "Docker", rating: 4 }).expect(201)).body.skill;
  await agent.patch(`/api/visibility/skills/${skill._id}`).send({ showInResume: false }).expect(200);
  assert.ok((await showcase()).skills.some((item) => item.name === "Docker"));
  assert.ok(!(await showcase("resume")).skills.some((item) => item.name === "Docker"));

  // Checked and owned
  await agent.patch(`/api/visibility/projects/${bank._id}`).send({ showInResume: "no" }).expect(400);
  await agent.patch(`/api/visibility/projects/${bank._id}`).send({}).expect(400);
  await agent.patch(`/api/visibility/nothing/${bank._id}`).send({ showInResume: true }).expect(404);
  await other.patch(`/api/visibility/projects/${bank._id}`).send({ showInResume: true }).expect(404);
});

test("one resume's own settings sit on top of the shared ones", async () => {
  let { settings } = (await agent.patch("/api/resume-settings").send({ designId: "navy", limits: { projects: 1 }, accent: "#1e3a8a" }).expect(200)).body;
  assert.deepEqual(settings.designs.navy, { hiddenEntries: [], accent: "#1e3a8a", limits: { projects: 1 } });
  assert.equal(settings.limits.projects, 2, "the shared setting is unchanged");
  ({ settings } = (await agent.patch("/api/resume-settings").send({ designId: "navy", reset: true }).expect(200)).body);
  assert.deepEqual(settings.designs.navy, { hiddenEntries: [], accent: "" });
  await agent.patch("/api/resume-settings").send({ designId: "navy", accent: "blue" }).expect(400);
});

test("the resume chat changes this resume, every resume or the portfolio", async () => {
  const chat = async (designId, message) => (await agent.post(`/api/resume-chat/${designId}`).send({ message }).expect(200)).body;
  const bank = (await agent.get("/api/projects").expect(200)).body.projects.find((item) => item.title === "Blood Bank Management System");
  await agent.patch(`/api/visibility/projects/${bank._id}`).send({ showInResume: true, showInPortfolio: true }).expect(200);

  // This resume only, found by name
  let body = await chat("navy", "hide the Blood Bank project");
  assert.equal(body.changed, true);
  assert.match(body.reply, /left Blood Bank Management System off this resume/);
  assert.deepEqual(body.settings.designs.navy.hiddenEntries, [`projects:${bank._id}`]);
  assert.ok(body.steps.some((step) => /MCP tool list_entries/.test(step)));
  assert.ok(body.steps.some((step) => /update_resume_settings/.test(step)));

  // Limits and sections, this resume only
  body = await chat("navy", "only 1 project and add interests");
  assert.deepEqual(body.settings.designs.navy.limits, { projects: 1 });
  assert.ok(body.settings.designs.navy.extras.includes("interests"));
  assert.deepEqual(body.settings.extras, [], "the shared settings are unchanged");

  // A colour, without the A2A agent: read in-process
  body = await chat("navy", "make it red");
  assert.match(body.settings.designs.navy.accent, /^#[0-9a-f]{6}$/i);
  assert.ok(body.steps.some((step) => /in-process/.test(step)));

  // Found by meaning (RAG), for every resume
  body = await chat("ivy", "hide the LangGraph platform from all my resumes");
  assert.match(body.reply, /hid UltraUnityVerse on every resume/);
  assert.ok(!(await showcase("resume")).projects.some((item) => item.title === "UltraUnityVerse"));

  // The portfolio
  body = await chat("ivy", "remove Blood Bank Management System from my portfolio");
  assert.match(body.reply, /on your portfolio/);
  assert.ok(!(await showcase()).projects.some((item) => item.title === "Blood Bank Management System"));

  // Reset and an unknown name
  body = await chat("navy", "reset this resume");
  assert.deepEqual(body.settings.designs.navy, { hiddenEntries: [], accent: "" });
  body = await chat("navy", "hide the Zorblax project");
  assert.equal(body.changed, false);
  assert.match(body.reply, /couldn't find "Zorblax project"/);

  await agent.post("/api/resume-chat/Bad Id").send({ message: "hi" }).expect(400);
  await agent.post("/api/resume-chat/navy").send({ message: "" }).expect(400);
});

test("a project inside a job has the same two switches, and the chat finds it", async () => {
  const job = (await agent.post("/api/experiences").send({
    organization: "Oracle", jobTitle: "AI Engineer", employmentType: "Full-time", startMonth: 1, startYear: 2024, currentlyWorking: true
  })).body.experience;
  assert.ok(job, "job created");
  const project = (await agent.post(`/api/experiences/${job._id}/projects`).send({ title: "Knowledge Assistant" }).expect(201)).body.project;

  assert.ok((await showcase("resume")).projects.some((item) => item.title === "Knowledge Assistant"));
  await agent.patch(`/api/visibility/experience_project/${project._id}`).send({ showInResume: false }).expect(200);
  assert.ok(!(await showcase("resume")).projects.some((item) => item.title === "Knowledge Assistant"));
  assert.ok((await showcase()).projects.some((item) => item.title === "Knowledge Assistant"));
  await agent.patch(`/api/visibility/experience_project/${project._id}`).send({ showInResume: true }).expect(200);

  const body = (await agent.post("/api/resume-chat/navy").send({ message: "hide the Knowledge Assistant project" }).expect(200)).body;
  assert.deepEqual(body.settings.designs.navy.hiddenEntries, [`projects:${project._id}`]);
  const status = (await agent.post("/api/resume-chat/navy").send({ message: "what's on this resume?" }).expect(200)).body;
  assert.match(status.reply, /This resume shows .* Left off it: Knowledge Assistant\./);
  assert.equal((await agent.get("/api/resume-chat/status").expect(200)).body.ai.available, false);
});

test("a whole section comes off one resume, and asking for all of it brings it back", async () => {
  const chat = async (message) => (await agent.post("/api/resume-chat/rose").send({ message }).expect(200)).body;
  await agent.post("/api/certifications").send({ name: "AWS Solutions Architect", issuingOrganization: "AWS" }).expect(201);
  await agent.post("/api/certifications").send({ name: "Google Cloud AI Agents", issuingOrganization: "Google" }).expect(201);

  let body = await chat("please remove all the certificates, I don't want those on here");
  assert.equal(body.changed, true);
  assert.equal(body.settings.designs.rose.hiddenEntries.filter((key) => key.startsWith("certifications:")).length, 2);
  assert.equal((await showcase("resume")).certifications.length, 2, "the switches themselves stay on");

  body = await chat("show all my certifications");
  assert.equal(body.settings.designs.rose.hiddenEntries.filter((key) => key.startsWith("certifications:")).length, 0);
  assert.equal(body.settings.designs.rose.limits.certifications, 0);

  // Named asides and a colour word in a name don't confuse it
  body = await chat("hide the Black Friday project");
  assert.equal(body.changed, false);
  assert.equal(body.settings.designs.rose.accent, "");
});

test("the language model's reading is kept only where the message says so", async () => {
  const { runResumeCustomizer } = require("../services/agents/resumeCustomizer");
  const calls = [];
  const tools = {
    call: async (name, args = {}) => {
      calls.push([name, args]);
      if (name === "list_entries") return { entries: [{ section: "projects", id: "a".repeat(24), label: "Housing Analytics" }, { section: "experience", id: "b".repeat(24), label: "AI Engineer at Oracle" }] };
      if (name === "search_portfolio") return { mode: "keyword (BM25)", results: [{ id: `experience:${"b".repeat(24)}`, text: "AI Engineer at Oracle" }], graph: { facts: [] } };
      return {};
    }
  };
  // What mistral really did: a made-up entry and a section nobody mentioned
  const llm = { invokeJson: async () => ({ showEntries: ["Software Engineer at XYZ Corporation"], hideEntries: ["housing analytics"], limits: { education: 1 }, scope: "all", reset: true }) };
  const result = await runResumeCustomizer({ text: "I would like my housing analytics work taken away from this one", designId: "navy", llm, tools });
  const saved = calls.find(([name]) => name === "update_resume_settings")[1];
  assert.deepEqual(saved, { designId: "navy", hideEntries: [`projects:${"a".repeat(24)}`] });
  assert.match(result.reply, /left Housing Analytics off this resume/);
});

test("column widths and other sizes are saved per resume, and a reset clears them", async () => {
  const chat = async (message) => (await agent.post("/api/resume-chat/slate-size").send({ message, layout: "right", sideWidth: 34 }).expect(200)).body;

  let body = await chat("Can U Increase right Layout by 5%");
  assert.equal(body.changed, true, body.reply);
  assert.deepEqual(body.settings.designs["slate-size"].tweaks, { sideShift: 5 });

  body = await chat("increase right layout by 5% and tighter spacing");
  assert.deepEqual(body.settings.designs["slate-size"].tweaks, { sideShift: 10, spacing: -10 });
  assert.equal(body.settings.tweaks?.sideShift, undefined, "other resumes keep their widths");

  body = await chat("put the column widths back to default");
  assert.equal(body.settings.designs["slate-size"].tweaks.sideShift, 0);

  await agent.patch("/api/resume-settings").send({ tweaks: "wide" }).expect(400);
  // Nonsense sizes are dropped, not saved
  body = (await agent.patch("/api/resume-settings").send({ designId: "slate-size", tweaks: { text: 9000, nope: 3, margin: 20 } }).expect(200)).body;
  assert.deepEqual(body.settings.designs["slate-size"].tweaks, { sideShift: 0, spacing: -10, margin: 20 });

  body = (await agent.patch("/api/resume-settings").send({ designId: "slate-size", reset: true }).expect(200)).body;
  assert.equal(body.settings.designs["slate-size"]?.tweaks, undefined);
});

test("the resume chat moves whole sections between the columns", async () => {
  const chat = async (message, layout = "left") => (await agent.post("/api/resume-chat/slate").send({ message, layout }).expect(200)).body;

  let body = await chat("Can U move Education to right column");
  assert.equal(body.changed, true, body.reply);
  assert.deepEqual(body.settings.designs.slate.columns, { education: "right" });
  assert.match(body.reply, /Education in the right column/);

  body = await chat("move skills and certs to the left");
  assert.deepEqual(body.settings.designs.slate.columns, { education: "right", skills: "left", certifications: "left" });
  body = await chat("the summary should be in the sidebar");
  assert.equal(body.settings.designs.slate.columns.summary, "side");
  body = await chat("put interests on the right side");
  assert.equal(body.settings.designs.slate.columns.interests, "right");
  assert.ok(body.settings.designs.slate.extras.includes("interests"), "a moved optional section is added");

  // Only this resume, and reset undoes it
  assert.deepEqual(body.settings.columns, {});
  body = await chat("reset this resume");
  assert.equal(body.settings.designs.slate.columns, undefined);

  // Every resume: a design's own choice gives way
  await chat("move education to the left column");
  body = await chat("move education to the right column on all my resumes");
  assert.equal(body.settings.columns.education, "right");
  assert.equal(body.settings.designs.slate.columns?.education, undefined);
  await agent.patch("/api/resume-settings").send({ columns: { education: "main" } }).expect(200);

  // One column: says so and saves nothing
  body = await chat("reset this resume");
  body = await chat("move education to the right column", "single");
  assert.equal(body.changed, false);
  assert.match(body.reply, /one column/);
  assert.equal(body.settings.designs.slate.columns, undefined);

  // A single entry can't move, and nothing else gets read as a move
  body = await chat("move Blood Bank to the right column");
  assert.equal(body.changed, false);
  assert.match(body.reply, /whole sections/);
  assert.equal(body.settings.designs.slate.columns, undefined);
  for (const message of ["what did i hide", "hide the Side Hustle project", "show all my certifications", "education left off"]) {
    const { columns } = (await chat(message)).settings.designs.slate;
    assert.equal(columns, undefined, message);
  }
  await agent.patch("/api/resume-settings").send({ designId: "slate", reset: true }).expect(200);
  await agent.patch("/api/resume-settings").send({ columns: "right" }).expect(400);
});

test("the resume chat reads typos and casual wording, without a language model", async () => {
  const chat = async (message) => (await agent.post("/api/resume-chat/teal").send({ message }).expect(200)).body;
  const key = (title) => agent.get("/api/projects").then(({ body }) => `projects:${body.projects.find((item) => item.title === title)._id}`);
  const bank = await key("Blood Bank Management System");
  const uuv = await key("UltraUnityVerse");

  let body = await chat("hide teh blod bank projct");
  assert.match(body.readAs, /blood bank project/);
  assert.ok(body.settings.designs.teal.hiddenEntries.includes(bank));
  assert.ok(body.steps.some((step) => /Read your words as/.test(step)));

  body = await chat("put blood bank bak");
  assert.ok(!body.settings.designs.teal.hiddenEntries.includes(bank));

  body = await chat("I would like my ultraunityverse work taken away from this one");
  assert.ok(body.settings.designs.teal.hiddenEntries.includes(uuv), body.reply);
  assert.ok(body.steps.some((step) => /trained models/.test(step)), body.steps.join("; "));

  body = await chat("only 1 projct");
  assert.equal(body.settings.designs.teal.limits.projects, 1);
  body = await chat("add intrests");
  assert.ok(body.settings.designs.teal.extras.includes("interests"));
  body = await chat("make it nvay");
  assert.match(body.settings.designs.teal.accent, /^#/);
  body = await chat("what did i hide");
  assert.match(body.reply, /This resume shows/);
  body = await chat("rest this resume");
  assert.deepEqual(body.settings.designs.teal, { hiddenEntries: [], accent: "" });
  body = await chat("helo");
  assert.equal(body.changed, false);
  assert.match(body.reply, /^Hi!/);
  body = await chat("purple monkey dishwasher");
  assert.equal(body.changed, false, body.reply);
  assert.equal(body.settings.designs.teal.accent, "");
});
