const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
// Nothing listens here: the agents run on rules alone, as without Ollama
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9";
process.env.A2A_DESIGNER_URL = "off";

const password = "a-long-test-password";
let mongoServer;
let agent;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  const app = require("../app")({ sessionStore: new session.MemoryStore() });

  await request(app).post("/api/auth/register").send({
    username: "chat_owner", email: "chat_owner@example.com", password, confirmPassword: password
  }).expect(201);
  agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "chat_owner", password }).expect(200);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const say = async (text, extra = {}) => (await agent.post("/api/chat/message").send({ text, ...extra }).expect(200)).body;
const last = (body) => body.messages[1];

test("the section's model decides what to ask; the entry waits in the buffer until confirmed", async () => {
  let body = await say("I studied Computer Science at University of North Texas from 2021 to 2023");
  assert.equal(last(body).agent, "data-entry");
  assert.match(last(body).text, /What degree was it/);
  assert.deepEqual(body.pending, { section: "education", asked: "degree" });
  assert.ok(last(body).steps.some((step) => /school or university, degree required/.test(step)));

  body = await say("M.S.");
  assert.match(last(body).text, /put "M\.S\. in Computer Science at University of North Texas" in your Education buffer/);
  assert.deepEqual(last(body).links, [{ label: "Review in Education", to: "/dashboard/education" }]);
  assert.equal(body.pending, null);
  assert.equal(body.changed.buffer, true);

  // Nothing in the portfolio yet
  assert.equal((await agent.get("/api/educations").expect(200)).body.educations.length, 0);
  const { drafts } = (await agent.get("/api/drafts?section=education").expect(200)).body;
  assert.equal(drafts.length, 1);
  assert.deepEqual(drafts[0].data, {
    institution: "University of North Texas", degree: "M.S.", fieldOfStudy: "Computer Science", startYear: 2021, endYear: 2023
  });

  // The user fixes a field, then confirms: the section's controller adds it
  await agent.patch(`/api/drafts/${drafts[0].id}`).send({ data: { grade: "3.9" } }).expect(200);
  await agent.post(`/api/drafts/${drafts[0].id}/confirm`).expect(201);
  const { educations } = (await agent.get("/api/educations").expect(200)).body;
  assert.equal(educations.length, 1);
  assert.equal(educations[0].grade, "3.9");
  assert.equal((await agent.get("/api/drafts").expect(200)).body.drafts.length, 0);
});

test("GraphRAG spots an entry the user already has", async () => {
  const body = await say("Add my MS in Computer Science from University of North Texas");
  assert.match(last(body).text, /You already have "M\.S\. at University of North Texas"/);
  assert.ok(last(body).steps.some((step) => /GraphRAG found a similar entry/.test(step)));
  const { drafts } = (await agent.get("/api/drafts").expect(200)).body;
  assert.match(drafts[0].notes[0], /check this isn't a repeat/);
  await agent.delete(`/api/drafts/${drafts[0].id}`).expect(200);
});

test("a past job is asked whether it's current, then for its end year", async () => {
  let body = await say("I worked as a Data Scientist at Verizon from 2021");
  assert.match(last(body).text, /Do you still work there/);
  assert.deepEqual(last(body).choices, ["Yes", "No", "Cancel"]);

  body = await say("No");
  assert.match(last(body).text, /What year did it end/);
  body = await say("I'm not sure");
  assert.match(last(body).text, /Sorry, I couldn't read that\. What year did it end/);
  body = await say("2022");
  assert.match(last(body).text, /Experience buffer/);

  const { drafts } = (await agent.get("/api/drafts?section=experience").expect(200)).body;
  await agent.post(`/api/drafts/${drafts[0].id}/confirm`).expect(201);
  assert.equal((await agent.get("/api/experiences").expect(200)).body.experiences[0].organization, "Verizon");
});

test("an unfinished entry can be cancelled", async () => {
  let body = await say("I volunteered at Code.org", { mode: "entry" });
  assert.match(last(body).text, /What was your role/);
  body = await say("cancel");
  assert.match(last(body).text, /dropped that volunteering role/);
  assert.equal(body.pending, null);
});

test("\"I want to add a project\" is a request, not a project called \"A project\"", async () => {
  let body = await say("I want to add A project");
  assert.equal(last(body).agent, "data-entry");
  assert.match(last(body).text, /^Sure, let's add a project\. What's the title\?/);
  assert.match(last(body).text, /its name, what it does/);
  assert.ok(last(body).steps.some((step) => /NLP: your message asks to add a project but gives no details/.test(step)));
  assert.equal((await agent.get("/api/drafts?section=projects").expect(200)).body.drafts.length, 0);

  // A generic answer is asked again; a real name is taken, without the "it's called"
  body = await say("a project");
  assert.match(last(body).text, /Sorry, I couldn't read that\. What's the title/);
  body = await say("hmm");
  assert.match(last(body).text, /Sorry, I couldn't read that\. What's the title/);
  body = await say("It's called JobPilot");
  assert.match(last(body).text, /put "JobPilot" in your Projects buffer \(title\)/);
  const { drafts } = (await agent.get("/api/drafts?section=projects").expect(200)).body;
  assert.deepEqual(drafts[0].data, { title: "JobPilot" });
  await agent.delete(`/api/drafts/${drafts[0].id}`).expect(200);
});

test("an answer that says more fills the other fields too", async () => {
  let body = await say("Please add my certification");
  assert.match(last(body).text, /Sure, let's add a certification/);
  body = await say("AWS Solutions Architect from Amazon Web Services in 2024");
  assert.match(last(body).text, /put "AWS Solutions Architect from Amazon Web Services" in your Certifications buffer/);
  const { drafts } = (await agent.get("/api/drafts?section=certifications").expect(200)).body;
  const draft = drafts.find((item) => item.data.name === "AWS Solutions Architect");
  assert.deepEqual(draft.data, { name: "AWS Solutions Architect", issuingOrganization: "Amazon Web Services", issueYear: 2024 });
  await agent.delete(`/api/drafts/${draft.id}`).expect(200);
});

test("an \"Add a project\" message with labelled lines goes to Projects, whatever its description mentions", async () => {
  const message = [
    "Add A project",
    "Project name: UltraUnityVerse: Agentic AI Career Portfolio Platform",
    "Tagline: Your Career, Unified",
    "Type: Personal · Full-stack · Generative AI / Agentic AI",
    "",
    "Description",
    "A full-stack career platform where a user records their portfolio once (profile, experience, education, projects, skills, certifications and more) and turns it into portfolio websites, ATS-friendly resumes and evidence-based job-match reports."
  ].join("\n");
  const body = await say(message);
  assert.match(last(body).text, /put "UltraUnityVerse: Agentic AI Career Portfolio Platform" in your Projects buffer/);
  assert.ok(last(body).steps.some((step) => /Picked Projects: you asked to "add a project"/.test(step)));
  const { drafts } = (await agent.get("/api/drafts?section=projects").expect(200)).body;
  const draft = drafts.find((item) => item.data.title?.startsWith("UltraUnityVerse"));
  assert.equal(draft.data.projectType, "Personal");
  assert.match(draft.data.description, /^A full-stack career platform/);
  assert.match(draft.data.description, /Tagline: Your Career, Unified$/);
  await agent.post(`/api/drafts/${draft.id}/confirm`).expect(201);
});

test("skills: several in one message, each its own entry", async () => {
  let body = await say("add Python, LangGraph and RAG to my skills");
  assert.match(last(body).text, /^I've put "Python", "LangGraph" and "RAG" in your Skills buffer\./);
  let { drafts } = (await agent.get("/api/drafts?section=skills").expect(200)).body;
  assert.deepEqual(drafts.map((draft) => draft.data.name).sort(), ["LangGraph", "Python", "RAG"]);
  for (const draft of drafts) await agent.post(`/api/drafts/${draft.id}/confirm`).expect(201);

  body = await say("I want to add a skill");
  assert.match(last(body).text, /Which skills should I add/);
  body = await say("Docker and Kubernetes");
  ({ drafts } = (await agent.get("/api/drafts?section=skills").expect(200)).body);
  assert.deepEqual(drafts.map((draft) => draft.data.name).sort(), ["Docker", "Kubernetes"]);
  for (const draft of drafts) await agent.delete(`/api/drafts/${draft.id}`).expect(200);
});

test("a skill you already have isn't added again, whatever its case", async () => {
  // Python, LangGraph and RAG were confirmed in the test before
  let body = await say("add python, PYTORCH and pytorch to my skills");
  assert.match(last(body).text, /^I've put "PyTorch" in your Skills buffer/);
  assert.match(last(body).text, /I didn't add "Python" and "PyTorch": Python \(you already have it as "Python"\); PyTorch \("PyTorch" is already waiting in the buffer\)\./);
  assert.ok(last(body).steps.some((step) => /Used the catalog's spelling "PyTorch" for "PYTORCH"/.test(step)));

  body = await say("add Pytorch to my skills");
  assert.match(last(body).text, /^Nothing new to add\. I didn't add "PyTorch": "PyTorch" is already waiting in the buffer\./);
  assert.deepEqual(last(body).links, []);

  const { drafts } = (await agent.get("/api/drafts?section=skills").expect(200)).body;
  assert.deepEqual(drafts.map((draft) => draft.data.name), ["PyTorch"]);
  await agent.delete(`/api/drafts/${drafts[0].id}`).expect(200);
});

test("summary and profile are updated, not added", async () => {
  let body = await say("update my summary to: AI Engineer building LangGraph agents and RAG systems for production use.");
  assert.match(last(body).text, /^I've prepared an update to your Summary \(summary\)/);
  let { drafts } = (await agent.get("/api/drafts?section=summary").expect(200)).body;
  await agent.post(`/api/drafts/${drafts[0].id}/confirm`).expect(201);
  assert.match((await agent.get("/api/summary").expect(200)).body.summary.content, /^AI Engineer building LangGraph agents/);

  // No profile yet: the agent asks for the contact details a profile needs
  body = await say("My phone number is 940-555-1234");
  assert.ok(last(body).steps.some((step) => /isn't set up yet/.test(step)));
  assert.match(last(body).text, /What's the first name\?/);
  body = await say("cancel");

  body = await say("I'm looking for Data Scientist or ML Engineer roles", { mode: "entry" });
  assert.match(last(body).text, /first name/);
  await say("cancel");
});

test("recommendations are read from the message", async () => {
  await say("Add a recommendation from Jane Doe, my manager at Verizon: \"Uday ships reliable ML systems and mentors the team.\"");
  const { drafts } = (await agent.get("/api/drafts?section=recommendations").expect(200)).body;
  assert.deepEqual(drafts[0].data, {
    firstName: "Jane", lastName: "Doe", relationship: "Manager", recommenderOrganization: "Verizon",
    text: "Uday ships reliable ML systems and mentors the team."
  });
  await agent.post(`/api/drafts/${drafts[0].id}/confirm`).expect(201);
});

test("when the section is unclear the agent asks, then reads the original message for it", async () => {
  let body = await say("I want to add something", { mode: "entry" });
  assert.match(last(body).text, /which section/i);
  assert.ok(last(body).choices.includes("Projects"));
  body = await say("Projects");
  assert.match(last(body).text, /Sure, let's add a project/);
  body = await say("cancel");
  assert.equal(body.pending, null);
});

test("when the supervisor can't tell what a message wants, it asks", async () => {
  let body = await say("banana quantum zebra");
  assert.equal(last(body).agent, "supervisor");
  assert.match(last(body).text, /add this to your portfolio, change a portfolio design, or ask a question/);
  assert.ok(last(body).steps.some((step) => /not sure what you meant/i.test(step)));
  body = await say("Ask about my portfolio");
  assert.equal(last(body).agent, "qa");
});

test("a new entry while a question is waiting sets the unfinished one aside", async () => {
  let body = await say("I studied at Purdue University", { mode: "entry" });
  assert.match(last(body).text, /What degree was it/);
  body = await say("Computer Science");
  assert.match(last(body).text, /Sorry, I couldn't read that\. What degree was it/);
  body = await say("I worked as a Software Engineer at Acme from 2019 to 2020");
  assert.match(last(body).text, /set aside the unfinished education entry/);
  assert.match(last(body).text, /Experience buffer/);
  const { drafts } = (await agent.get("/api/drafts?section=experience").expect(200)).body;
  assert.equal(drafts[0].data.organization, "Acme");
  await agent.delete(`/api/drafts/${drafts[0].id}`).expect(200);
});

test("a controller's rule that fails on confirm keeps the entry in the buffer with the reason", async () => {
  await say("Add certification \"AWS Solutions Architect\" from Amazon in 2024");
  const { drafts } = (await agent.get("/api/drafts?section=certifications").expect(200)).body;
  await agent.patch(`/api/drafts/${drafts[0].id}`).send({ data: { issueMonth: 5, issueYear: 2024, expirationYear: 2020 } }).expect(200);
  const res = await agent.post(`/api/drafts/${drafts[0].id}/confirm`).expect(400);
  assert.ok(res.body.message);
  assert.equal((await agent.get("/api/drafts?section=certifications").expect(200)).body.drafts[0].error, res.body.message);
});

test("the design agent creates and edits custom designs through MCP", async () => {
  let body = await say("Make a dark green Slate design called Forest and hide projects");
  assert.equal(last(body).agent, "design");
  assert.match(last(body).text, /Made "Forest" from Slate: accent #14532d, hid projects/);
  assert.ok(last(body).steps.some((step) => /in-process/.test(step)));
  assert.equal(body.changed.designs, true);

  const id = body.changed.designId;
  body = await say("use Playfair Display for headings and put skills first", { context: { path: `/portfolio/custom-${id}` } });
  assert.match(last(body).text, /Updated "Forest": Playfair Display for headings, order starts with skills/);

  const { design } = (await agent.get(`/api/custom-designs/${id}`).expect(200)).body;
  assert.equal(design.headingFont, "Playfair Display");
  assert.deepEqual(design.hidden, ["projects"]);
  assert.equal(design.order[0], "skills");

  await agent.patch(`/api/custom-designs/${id}`).send({ changes: { titles: { experience: "Where I've worked" } } }).expect(200);
  assert.equal((await agent.get(`/api/custom-designs/${id}`).expect(200)).body.design.titles.experience, "Where I've worked");

  body = await say("delete this design", { context: { path: `/portfolio/custom-${id}` } });
  assert.match(last(body).text, /Deleted "Forest"/);
  assert.equal((await agent.get("/api/custom-designs").expect(200)).body.designs.length, 0);
});

test("the Q&A agent answers from the portfolio with RAG and GraphRAG", async () => {
  const body = await say("Where did I study?");
  assert.equal(last(body).agent, "qa");
  assert.match(last(body).text, /University of North Texas/);
  assert.ok(last(body).steps.some((step) => /keyword \(BM25\)/.test(step)));
  assert.ok(last(body).sources.some((source) => source.detail === "education"));
});

test("the chat is kept, can be cleared, and refuses bad input", async () => {
  const { body } = await agent.get("/api/chat").expect(200);
  assert.ok(body.messages.length >= 10);
  assert.equal(body.ai.available, false);
  await agent.post("/api/chat/message").send({ text: "" }).expect(400);
  await agent.get("/api/drafts?section=nope").expect(400);
  await agent.delete("/api/chat").expect(200);
  assert.equal((await agent.get("/api/chat").expect(200)).body.messages.length, 0);
});

test("the Portfolio Designer answers over A2A", async () => {
  const { startDesigner } = require("../a2a/designerAgent");
  const server = await startDesigner(0);
  process.env.A2A_DESIGNER_URL = `http://localhost:${server.address().port}`;
  try {
    const { planViaA2A } = require("../a2a/designerClient");
    const plan = await planViaA2A({ request: "new Code Editor design in #ff6600, always dark", custom: [], currentId: "" });
    assert.equal(plan.action, "create");
    assert.equal(plan.baseId, "ide");
    assert.deepEqual(plan.changes, { accent: "#ff6600", mode: "dark" });
  } finally {
    process.env.A2A_DESIGNER_URL = "off";
    server.close();
  }
});

test("the MCP server lists the agents' tools", async () => {
  const { connectForUser } = require("../mcp/userToolClient");
  const tools = await (await connectForUser({ id: new mongoose.Types.ObjectId().toString(), username: "x", email: "x@example.com" })).tools();
  for (const name of ["list_section_schemas", "search_portfolio", "find_existing_entry", "get_section_record", "add_to_buffer", "list_buffer", "list_custom_designs", "apply_design_plan"]) {
    assert.ok(tools.includes(name), name);
  }
});

test("NLP and ML: request words, generic names, intents and sections", async () => {
  const { classifyIntent, classifySection, splitRequest, isGenericValue, answerValue } = require("../services/agents/textUnderstanding");
  const options = { useEmbeddings: false };

  assert.equal(splitRequest("I want to add A project").requestOnly, true);
  assert.equal(splitRequest("Could you please add a new job for me?").requestOnly, true);
  assert.equal(splitRequest("I want to add my masters").requestOnly, false);
  assert.equal(splitRequest("add a project called JobPilot").requestOnly, false);
  assert.deepEqual(["A project", "my new job", "the degree", "JobPilot", "Project Atlas"].map(isGenericValue), [true, true, true, false, false]);
  assert.equal(answerValue("It is called JobPilot."), "JobPilot");

  assert.equal((await classifyIntent("I want to add a project", options)).top, "entry");
  assert.equal((await classifyIntent("make my portfolio purple", options)).top, "design");
  assert.equal((await classifyIntent("which jobs used python", options)).top, "qa");
  assert.equal((await classifySection("an award I won at a hackathon", options)).top, "achievements");
  assert.equal((await classifySection("my capstone I developed", options)).top, "projects");
  assert.equal((await classifyIntent("banana quantum zebra", options)).confident, false);
});

test("a language model's guesses are dropped unless the words support them", () => {
  const { groundedValues } = require("../services/agents/dataEntryAgent");
  const { specOf } = require("../services/agents/sectionSpecs");
  const spec = specOf("projects");
  const text = "I want to add A project";
  assert.deepEqual(groundedValues(spec, { title: "A project", status: "Planned", description: "I want to add A project" }, text), {});

  const said = "I want to add a project called JobPilot that I finished in 2024, it scores resumes against job descriptions";
  assert.deepEqual(groundedValues(spec, {
    title: "JobPilot", status: "Completed", projectType: "Academic",
    description: "I want to add a project called JobPilot that scores resumes against job descriptions"
  }, said), {
    title: "JobPilot", status: "Completed",
    description: "A project called JobPilot that scores resumes against job descriptions"
  });
});

test("a project's name and the words after it are read without a model; months are never guessed", () => {
  const { ruleExtract, groundedValues } = require("../services/agents/dataEntryAgent");
  const { specOf } = require("../services/agents/sectionSpecs");
  const text = "I want to add a project called ResumeRAG, a RAG assistant I built in 2024 with LangGraph that answers questions about resumes";
  assert.deepEqual(ruleExtract("projects", text), {
    startYear: 2024, title: "ResumeRAG", description: "A RAG assistant I built in 2024 with LangGraph that answers questions about resumes."
  });
  assert.deepEqual(groundedValues(specOf("projects"), { title: "ResumeRAG", startMonth: 1, startYear: 2024 }, text), { title: "ResumeRAG", startYear: 2024 });
  assert.equal(groundedValues(specOf("projects"), { startMonth: 3, startYear: 2024 }, "started it in March 2024").startMonth, 3);
});

test("one chat: the intent is detected, and a correction re-runs the message and retrains the user's model", async () => {
  await agent.delete("/api/chat").expect(200);
  // The base model has never seen this phrasing, so it isn't sure
  let body = await say("spice things up");
  const wrong = last(body);
  assert.notEqual(wrong.agent, "design");

  // The user says it was a design request
  body = (await agent.post("/api/chat/feedback").send({ messageId: wrong.id, agent: "design" }).expect(200)).body;
  assert.equal(last(body).agent, "design");
  assert.ok(last(body).steps.some((step) => /Using the design agent, as you asked/.test(step)));
  assert.equal(body.intentModel.corrections, 1);

  // Correcting to the agent it already went to is refused; unknown ids 404
  await agent.post("/api/chat/feedback").send({ messageId: last(body).id, agent: "design" }).expect(400);
  await agent.post("/api/chat/feedback").send({ messageId: "nope", agent: "qa" }).expect(404);

  // The retrained model now reads that phrasing as design on its own
  body = await say("spice things up please");
  assert.equal(last(body).agent, "design");

  const { model, live } = (await agent.get("/api/chat/model").expect(200)).body;
  assert.equal(model.corrections, 1);
  assert.ok(model.crossValidation.ensembleAccuracy > 0.8);
  assert.ok(model.crossValidation.confusion.entry);
  assert.ok(live.decisions >= 2);
  assert.equal(live.corrections, 1);
});

test("the intent ensemble: cross-validated, and right on typical messages", async () => {
  const { detectIntent, base } = require("../services/agents/ml/intentEnsemble");
  assert.ok(base.metrics.ensembleAccuracy >= 0.85, `ensemble accuracy ${base.metrics.ensembleAccuracy}`);
  assert.ok(base.metrics.accuracy >= 0.75, `model accuracy ${base.metrics.accuracy}`);
  const cases = {
    "I want to add A project": "entry", "Make a dark green Slate design called Forest": "design", "What are my key skills?": "qa",
    "I don't like the font": "design", "do I know docker": "qa", "my phone number is 940 555 1234": "entry", "thanks": "help",
    "Add A project\nProject name: X\nDescription\nA platform that designs themes and answers questions about portfolios": "entry"
  };
  for (const [text, expected] of Object.entries(cases)) {
    const result = await detectIntent(text, { useEmbeddings: false });
    assert.equal(result.top, expected, text);
    assert.ok(result.confident, text);
  }
  assert.equal((await detectIntent("banana quantum zebra", { useEmbeddings: false })).confident, false);
});

test("a design can show only the first few items of a section", async () => {
  let body = await say("create a MONO MY Personal MONO Portfolio paGE IN THAT SHOW ONLY 2 PROJECTS ANSD 1 EXPERIUENCE");
  assert.equal(last(body).agent, "design");
  assert.match(last(body).text, /Made "My Mono" from Mono: only the first 2 projects, only the first 1 experience/);
  const id = body.changed.designId;
  let { design } = (await agent.get(`/api/custom-designs/${id}`).expect(200)).body;
  assert.deepEqual(design.limits, { projects: 2, experience: 1 });

  body = await say("Show only 3 projects in MONO");
  assert.match(last(body).text, /Updated "My Mono": only the first 3 projects/);
  body = await say("show all projects", { context: { path: `/portfolio/custom-${id}` } });
  ({ design } = (await agent.get(`/api/custom-designs/${id}`).expect(200)).body);
  assert.deepEqual(design.limits, { experience: 1 });
  await agent.delete(`/api/custom-designs/${id}`).expect(200);
});

test("the assistant changes what the resumes show", async () => {
  let { settings } = (await agent.get("/api/resume-settings").expect(200)).body;
  assert.deepEqual(settings, { limits: { experience: 0, education: 2, projects: 2, certifications: 0 }, extras: [], allSkills: false, columns: {}, hiddenFields: [], skillStyle: "", tweaks: {}, order: [], rewrites: {}, designs: {} });

  let body = await say("show all my projects on my resume");
  assert.equal(last(body).agent, "design");
  assert.match(last(body).text, /Your resumes now show all jobs, 2 schools, all projects, all certifications, key skills/);
  body = await say("add interests to my resume");
  assert.match(last(body).text, /interests\.$/);
  await say("3 jobs and all skills on my resume");
  ({ settings } = (await agent.get("/api/resume-settings").expect(200)).body);
  assert.deepEqual(settings, { limits: { experience: 3, education: 2, projects: 0, certifications: 0 }, extras: ["interests"], allSkills: true, columns: {}, hiddenFields: [], skillStyle: "", tweaks: {}, order: [], rewrites: {}, designs: {} });

  // The resume page's own switch
  ({ settings } = (await agent.patch("/api/resume-settings").send({ allSkills: false }).expect(200)).body);
  assert.equal(settings.allSkills, false);
  body = await say("reset my resume to default and remove interests from my resume");
  ({ settings } = (await agent.get("/api/resume-settings").expect(200)).body);
  assert.deepEqual(settings.limits, { experience: 0, education: 2, projects: 2, certifications: 0 });
  assert.deepEqual(settings.extras, []);
});
