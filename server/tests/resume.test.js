const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
// Nothing listens here, so the AI always counts as unavailable in tests
process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9";
// The A2A reviewer is tested in agents.test.js; here the built-in review runs
process.env.A2A_REVIEWER_URL = "off";

const password = "a-long-test-password";

let mongoServer;
let app;
let agent;
let ids;

// Reads the server-sent events of a /generate reply
const eventsIn = (text) =>
  text.split("\n\n").filter(Boolean).map((block) => ({
    event: block.match(/^event: (.*)$/m)?.[1],
    data: JSON.parse(block.match(/^data: (.*)$/m)?.[1] || "null")
  }));

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  app = createApp({ sessionStore: new session.MemoryStore() });

  await request(app).post("/api/auth/register").send({
    username: "resume_owner", email: "resume_owner@example.com", password, confirmPassword: password
  }).expect(201);
  agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "resume_owner", password }).expect(200);

  await agent.post("/api/summary").send({ content: "Data engineer who builds reliable pipelines and analytics platforms." }).expect(201);

  const older = await agent.post("/api/experiences").send({
    jobTitle: "Junior Analyst", organization: "First Co", startYear: 2018, endYear: 2020
  }).expect(201);
  const newer = await agent.post("/api/experiences").send({
    jobTitle: "Data Engineer", organization: "Example Co", startYear: 2021, currentlyWorking: true
  }).expect(201);
  const newerId = newer.body.experience._id;
  await agent.post(`/api/experiences/${newerId}/tasks`).send({ description: "- i worked on spark pipelines for reporting." }).expect(201);
  await agent.post(`/api/experiences/${newerId}/tasks`).send({ description: "Reduced nightly load time by 40% by rewriting jobs in PySpark" }).expect(201);

  const education = await agent.post("/api/educations").send({
    institution: "Example University", degree: "Master of Science", startYear: 2016, endYear: 2018
  }).expect(201);

  const python = await agent.post("/api/skills").send({ name: "Python" }).expect(201);
  const sql = await agent.post("/api/skills").send({ name: "SQL" }).expect(201);

  ids = {
    older: older.body.experience._id,
    newer: newerId,
    education: education.body.education._id,
    python: python.body.skill._id,
    sql: sql.body.skill._id
  };
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("resume sources list the portfolio, newest experience first, and report the AI status", async () => {
  await request(app).get("/api/resume/sources").expect(401);

  const { body } = await agent.get("/api/resume/sources").expect(200);

  assert.equal(body.sources.contact.email, "resume_owner@example.com");
  assert.match(body.sources.summary, /Data engineer/);
  assert.deepEqual(body.sources.experiences.map((item) => item.title), ["Data Engineer", "Junior Analyst"]);
  assert.equal(body.sources.educations.length, 1);
  assert.deepEqual(body.sources.skills.map((item) => item.name).sort(), ["Python", "SQL"]);
  assert.equal(body.ai.available, false);
});

test("a resume without AI contains only the chosen items, tidied and reviewed", async () => {
  const response = await agent.post("/api/resume/generate").send({
    sections: { summary: true, experience: true, education: false, projects: true, skills: true },
    experienceIds: [ids.newer],
    educationIds: [ids.education],
    projectIds: [],
    skillIds: [ids.python],
    useAi: false
  }).expect(200);

  const result = eventsIn(response.text).find((entry) => entry.event === "result").data;
  const { resume, review } = result;

  assert.deepEqual(resume.experience.map((item) => item.title), ["Data Engineer"]);
  assert.equal(resume.experience[0].dates, "2021 – Present");
  assert.deepEqual(resume.experience[0].bullets, [
    "I worked on spark pipelines for reporting.",
    "Reduced nightly load time by 40% by rewriting jobs in PySpark."
  ]);
  assert.equal(resume.education.length, 0, "education was switched off");
  assert.deepEqual(resume.skills.technical, ["Python"]);

  // The first-person bullet is flagged
  assert.ok(review.issues.some((issue) => /first-person/.test(issue.message)));
  assert.ok(review.score < 100);
  assert.equal(result.aiCalls, 0);
});

test("generate validates its input and refuses AI when Ollama is not available", async () => {
  const base = { experienceIds: [], educationIds: [], projectIds: [], skillIds: [] };

  await agent.post("/api/resume/generate").send({ ...base, skillIds: ["not-an-id"] }).expect(400);
  await agent.post("/api/resume/generate").send({ ...base, targetTitle: "x".repeat(121) }).expect(400);

  const refused = await agent.post("/api/resume/generate").send({ ...base, useAi: true }).expect(503);
  assert.match(refused.body.message, /Ollama/);
});

test("the agent keeps AI wording but drops bullets that invent numbers", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");

  const prompts = [];
  const fakeLlm = {
    async invokeJson(system, payload) {
      prompts.push(system);
      if (system.includes("Extract")) return { keywords: ["Spark", "Airflow"] };
      if (system.includes("professional summary")) {
        return { summary: "Data engineer building reliable Spark pipelines and analytics platforms for reporting teams." };
      }
      return {
        bullets: [
          "Built Spark pipelines that power daily reporting dashboards for the analytics and finance teams",
          "Cut nightly load time 40% by rewriting slow batch jobs in PySpark with partition pruning",
          "Led a team of 12 engineers across 3 time zones"
        ]
      };
    }
  };

  const source = {
    contact: { name: "Test User", email: "t@example.com", phone: "", location: "" },
    summary: "Data engineer.",
    experiences: [{
      id: "a".repeat(24), title: "Data Engineer", organization: "Example Co", location: "",
      start: { month: 1, year: 2021 }, end: null, current: true, summary: "", highlights: "",
      bullets: ["i worked on spark pipelines", "Reduced nightly load time by 40%"], skills: ["Spark", "PySpark"]
    }],
    educations: [],
    projects: [],
    skills: [{ id: "b".repeat(24), name: "Airflow", skillType: "technical" }, { id: "c".repeat(24), name: "Python", skillType: "technical" }]
  };

  const progress = [];
  const result = await buildResume({
    source,
    options: {
      sections: { summary: true, experience: true, education: true, projects: true, skills: true },
      targetTitle: "Data Engineer",
      jobDescription: "We need Spark and Airflow experience.",
      useAi: true
    },
    llm: fakeLlm,
    onProgress: (message) => progress.push(message)
  });

  assert.match(result.resume.summary, /Spark pipelines/);
  assert.deepEqual(result.resume.experience[0].bullets, [
    "Built Spark pipelines that power daily reporting dashboards for the analytics and finance teams.",
    "Cut nightly load time 40% by rewriting slow batch jobs in PySpark with partition pruning."
  ], "the bullet with made-up numbers (12, 3) is dropped");
  assert.deepEqual(result.resume.skills.technical, ["Airflow", "Python"], "job keywords first");
  assert.deepEqual(result.keywords, ["Spark", "Airflow"]);
  assert.equal(result.review.keywordCoverage, 100);
  assert.ok(progress.some((message) => /summary/i.test(message)));
  assert.equal(result.aiCalls, prompts.length);
});

test("job keywords keep skills and drop pay, location, titles and plain verbs", () => {
  const { isSkillKeyword, mentions } = require("../services/resume/atsRules");

  const fromModel = [
    "AI Solutions Engineer", "Generative AI", "LLMs", "RAG", "AI agents", "Onsite", "Wellesley, MA",
    "Salary Range", "$130,000-140,000", "comprehensive benefits package", "Design", "Develop", "Deploy",
    "CRM data", "Salesforce", "5+ years of experience", "Python", "CI/CD"
  ];

  assert.deepEqual(
    fromModel.filter((keyword) => isSkillKeyword(keyword, "AI Solutions Engineer")),
    ["Generative AI", "LLMs", "RAG", "AI agents", "CRM data", "Salesforce", "Python", "CI/CD"]
  );

  assert.ok(mentions("Built apps with LLM APIs", "LLMs"));
  assert.ok(mentions("Built an AI agent for support", "AI agents"));
  assert.ok(mentions("Set up ci-cd pipelines", "CI/CD"));
  assert.ok(!mentions("Java developer", "JavaScript"));
  assert.ok(mentions("C++ and C#", "C++"));
});

test("without AI, known skills in the job description are still matched", async () => {
  const response = await agent.post("/api/resume/generate").send({
    experienceIds: [ids.newer], educationIds: [], projectIds: [], skillIds: [ids.python, ids.sql],
    jobDescription: "Onsite in Austin, TX. $120k. Python, SQL, Kubernetes and Azure required. Go-getters welcome.",
    addMissingKeywords: false,
    useAi: false
  }).expect(200);

  const { review, keywords } = eventsIn(response.text).find((entry) => entry.event === "result").data;

  assert.deepEqual(keywords, ["Python", "SQL", "Kubernetes", "Azure"]);
  assert.deepEqual(review.matchedKeywords, ["Python", "SQL"]);
  assert.deepEqual(review.missingKeywords, ["Kubernetes", "Azure"]);
  assert.equal(review.keywordCoverage, 50);

  // When asked, the missing ones are added to Skills, and listed as added
  const withAdded = await agent.post("/api/resume/generate").send({
    experienceIds: [ids.newer], educationIds: [], projectIds: [], skillIds: [ids.python, ids.sql],
    jobDescription: "Python, SQL, Kubernetes and Azure required.",
    addMissingKeywords: true,
    useAi: false
  }).expect(200);
  const added = eventsIn(withAdded.text).find((entry) => entry.event === "result").data;

  assert.deepEqual(added.resume.skills.added, ["Kubernetes", "Azure"]);
  assert.deepEqual(added.resume.skills.groups, [
    { label: "Languages & Engineering", skills: ["Python", "SQL"] },
    { label: "Cloud & Data", skills: ["Kubernetes", "Azure"] }
  ]);
  assert.equal(added.review.keywordCoverage, 100);
});

test("the latest job gets 4 bullets and older jobs 2 or 3; the writer sees every task", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const seen = [];
  const fakeLlm = {
    async invokeJson(system, payload) {
      seen.push(payload);
      const verbs = ["Delivered", "Designed", "Automated", "Deployed", "Modeled", "Trained", "Implemented", "Optimized", "Integrated", "Scaled", "Streamlined", "Engineered"];
      const work = ["billing exports", "search indexing", "login flows", "nightly backups", "pricing rules", "audit trails",
        "email digests", "image resizing", "report scheduling", "cache warming", "invoice parsing", "alert routing"];
      const detail = ["across regional warehouses", "for mobile shoppers", "behind single sign-on", "on encrypted volumes",
        "for seasonal campaigns", "for compliance officers", "for weekly subscribers", "for product catalogs",
        "for quarterly planning", "before traffic peaks", "from supplier emails", "to on-call engineers"];
      return { bullets: verbs.map((verb, i) => `${verb} the ${work[i]} workflow ${detail[i]}, replacing a manual spreadsheet process entirely`) };
    }
  };
  const job = (id, year, tasks) => ({
    id: id.repeat(24), title: "Engineer", organization: "Co", location: "", start: { year }, end: null,
    current: false, summary: "", highlights: "", bullets: tasks, skills: [], projects: []
  });

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [
        job("a", 2023, ["Task one done well", "Task two done well", "Task three done well", "Task four done well", "Task five done well"]),
        job("b", 2020, ["Task one done well", "Task two done well", "Task three done well"]),
        job("c", 2018, ["Only one task here"])
      ],
      educations: [], projects: [], skills: []
    },
    options: { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: true },
    llm: fakeLlm
  });

  assert.deepEqual(result.resume.experience.map((item) => item.bullets.length), [4, 3, 2]);
  assert.equal(seen[0].tasks.length, 5, "all five tasks reach the writer, not just four");
  // First pass; the fake reuses one verb everywhere, so a fix-up pass follows
  assert.deepEqual(seen.filter((payload) => payload.bulletCount).slice(0, 3).map((payload) => payload.bulletCount), [4, 3, 2]);
});

test("optional sections appear only when added, and hidden contact details are left out", async () => {
  const kept = await agent.post("/api/certifications").send({
    name: "Cloud Practitioner", issuingOrganization: "Example Org", issueMonth: 3, issueYear: 2023
  }).expect(201);
  await agent.post("/api/certifications").send({ name: "Older Cert", issuingOrganization: "Example Org", issueYear: 2019 }).expect(201);

  const { body } = await agent.get("/api/resume/sources").expect(200);
  assert.deepEqual(body.sources.certifications.map((item) => item.title), ["Cloud Practitioner", "Older Cert"]);

  const base = { experienceIds: [], educationIds: [], projectIds: [], skillIds: [], useAi: false };
  const build = async (extra) => {
    const response = await agent.post("/api/resume/generate").send({ ...base, ...extra }).expect(200);
    return eventsIn(response.text).find((entry) => entry.event === "result").data;
  };

  // Not added: nothing, even with IDs sent
  const without = await build({ certificationIds: [kept.body.certification._id] });
  assert.equal(without.resume.extras.certifications.length, 0);

  const withCert = await build({
    sections: { certifications: true },
    certificationIds: [kept.body.certification._id],
    showContact: { email: false, location: false },
    instructions: "Keep it to one page"
  });

  assert.deepEqual(withCert.resume.extras.certifications.map((item) => [item.title, item.dates]), [["Cloud Practitioner", "Mar 2023"]]);
  assert.equal(withCert.resume.contact.email, "");
  assert.ok(!withCert.review.issues.some((issue) => /city and state/.test(issue.message)), "hidden location isn't reported missing");

  await agent.post("/api/resume/generate").send({ ...base, instructions: "x".repeat(1001) }).expect(400);
});

test("technical skills are grouped into resume categories, soft skills last", () => {
  const { groupSkills } = require("../services/resume/skillGroups");

  const groups = groupSkills(
    ["Python", "PyTorch", "LangGraph", "MCP", "RAG", "pgvector", "RAGAS", "MLflow", "AWS", "Azure OpenAI", "Docker", "Kafka", "Model Evaluation", "Jira", "SQL"],
    ["Communication"]
  );

  assert.deepEqual(groups, [
    { label: "Languages & Engineering", skills: ["Python", "SQL"] },
    { label: "Machine Learning", skills: ["PyTorch", "Model Evaluation"] },
    { label: "Generative AI & Agentic AI", skills: ["LangGraph", "MCP"] },
    { label: "RAG & Vector Search", skills: ["RAG", "pgvector"] },
    { label: "MLOps, LLMOps, Evaluation & Responsible AI", skills: ["RAGAS", "MLflow"] },
    { label: "Cloud & Data", skills: ["AWS", "Azure OpenAI", "Docker", "Kafka"] },
    { label: "Tools & Platforms", skills: ["Jira"] },
    { label: "Professional Skills", skills: ["Communication"] }
  ]);
});

test("each project gets one two-line bullet, with technologies found in its text", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const seen = [];
  const fakeLlm = {
    async invokeJson(system, payload) {
      seen.push(payload);
      return {
        bullets: [
          "Built a multi-agent research assistant where LangGraph agents collaborate over A2A and call tools through an MCP server, backed by a RAG pipeline in pgvector",
          "A second bullet that should be dropped for projects"
        ]
      };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [], educations: [], skills: [],
      projects: [{
        id: "p".repeat(24), title: "Agentic AI Research Assistant", role: "", start: null, end: null, current: false,
        description: "Multi-agent assistant built with LangGraph, MCP, A2A, FastAPI and a RAG pipeline in pgvector",
        bullets: ["designed agents", "built the API"], skills: ["React"], link: ""
      }]
    },
    options: { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: true },
    llm: fakeLlm
  });

  const [project] = result.resume.projects;
  assert.equal(project.bullets.length, 1);
  assert.ok(project.bullets[0].length > 140, "about two lines");
  assert.deepEqual(project.skills, ["React", "LangGraph", "MCP", "A2A", "FastAPI", "RAG", "pgvector"]);
  assert.equal(seen[0].bulletCount, 1);
  assert.ok(!result.review.issues.some((issue) => /longer than|add dates/.test(issue.message)));
});

test("the review catches placeholders, misspellings, duplicate and nonstandard skills, and missing end dates", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [{
        id: "a".repeat(24), title: "ML Engineer", organization: "Co", location: "", start: { year: 2021 }, end: null,
        current: false, summary: "", highlights: "", bullets: ["Handled Model Deployement for 3 services with HTML and SDLC docs"], skills: [], projects: []
      }],
      educations: [{
        id: "e".repeat(24), institution: "Example University", degree: "Master of Science", fieldOfStudy: "FLKSS",
        location: "", start: { year: 2019 }, end: { year: 2021 }, current: false, grade: "", description: "", bullets: [], courses: []
      }],
      projects: [],
      skills: ["OCI", "OracleSQL", "Oracle Cloud Infrastructure", "Python", "Pyhton Scripting"].map((name, i) => ({ id: String(i).repeat(24), name, skillType: "technical" }))
    },
    options: { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: false }
  });

  const messages = result.review.issues.map((issue) => issue.message);
  const has = (pattern) => messages.some((message) => pattern.test(message));

  assert.ok(has(/"FLKSS" looks like placeholder/));
  // Misspellings are fixed, not just reported
  assert.ok(!has(/Deployement/));
  assert.match(result.resume.experience[0].bullets[0], /Model Deployment/);
  assert.ok(result.notes.includes('Fixed spelling: "Deployement" → "Deployment".'));
  assert.ok(has(/add an end date or mark it as current/));
  assert.ok(!has(/"HTML"|"SDLC"/), "real acronyms aren't placeholders");
  assert.deepEqual(result.resume.skills.technical, ["OCI", "Oracle SQL", "Python", "Pyhton Scripting"]);
  assert.ok(result.notes.some((note) => /same skill as "OCI"/.test(note)));
  assert.ok(result.notes.some((note) => /"OracleSQL" as "Oracle SQL"/.test(note)));
});

test("the AI proofreader may fix typos but not reword", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("proofreader")) {
        return { texts: payload.texts.map((text) => text.replace("Langchian", "LangChain").replace("Created", "Engineered")) };
      }
      if (system.includes("professional summary")) return { summary: payload.currentSummary };
      return { bullets: payload.tasks };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" },
      summary: "Engineer who builds chatbots with Langchian and Python for support teams across the company.",
      experiences: [{
        id: "a".repeat(24), title: "Engineer", organization: "Co", location: "", start: { year: 2022 }, end: null, current: true,
        summary: "", highlights: "", skills: [], projects: [],
        bullets: ["Built a support chatbot with Langchian for customers", "Created dashboards for the support leads"]
      }],
      educations: [], projects: [], skills: []
    },
    options: { sections: { summary: true, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: true },
    llm: fakeLlm
  });

  assert.match(result.resume.summary, /with LangChain and Python/);
  assert.equal(result.resume.experience[0].bullets[0], "Built a support chatbot with LangChain for customers.");
  assert.equal(result.resume.experience[0].bullets[1], "Created dashboards for the support leads.", "rewording is refused");
  assert.ok(result.notes.includes('Fixed spelling: "Langchian" → "LangChain".'));
});

test("builds with a job description include a job match, and edits can be re-scored", async () => {
  const response = await agent.post("/api/resume/generate").send({
    experienceIds: [ids.newer], educationIds: [], projectIds: [], skillIds: [ids.python, ids.sql],
    jobDescription: "Python and Spark required. Kubernetes is a plus.",
    addMissingKeywords: false,
    useAi: false
  }).expect(200);
  const { resume, match } = eventsIn(response.text).find((entry) => entry.event === "result").data;

  assert.equal(typeof match.overall, "number");
  assert.ok(match.requirements.some((item) => item.text === "Kubernetes" && item.importance === "preferred"));

  const recalculated = await agent.post("/api/resume/match").send({ resume, requirements: match.requirements }).expect(200);
  assert.equal(recalculated.body.match.overall, match.overall);

  await agent.post("/api/resume/match").send({ resume, requirements: [{ text: "x", category: "nope", importance: "required" }] }).expect(400);
  await agent.post("/api/resume/match").send({ requirements: match.requirements }).expect(400);
});

test("bullets can't name tools from outside the entry, and repeated opening verbs are flagged", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("proofreader")) return { texts: payload.texts };
      return {
        bullets: [
          "Built churn models with XGBoost and PySpark across millions of records, improving retention targeting.",
          "Built a Kubernetes platform on AWS for the whole company, cutting costs."
        ]
      };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [{
        id: "a".repeat(24), title: "ML Engineer", organization: "Co", location: "", start: { year: 2022 }, end: { year: 2023 }, current: false,
        summary: "", highlights: "", projects: [], skills: ["XGBoost", "PySpark"],
        bullets: ["Churn models with XGBoost and PySpark on millions of records"]
      }],
      educations: [], projects: [], skills: []
    },
    options: { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: true },
    llm: fakeLlm
  });

  // The Kubernetes/AWS bullet names tools this job never mentions
  assert.deepEqual(result.resume.experience[0].bullets, [
    "Built churn models with XGBoost and PySpark across millions of records, improving retention targeting."
  ]);

  const { reviewResume } = require("../services/resume/atsRules");
  const review = reviewResume({
    sections: { summary: false, skills: false }, contact: { email: "e", phone: "1", location: "X" }, summary: "",
    experience: [{ id: "x", title: "A", organization: "B", start: { year: 2022 }, current: true, bullets: ["Built a thing with Python for users.", "Built another thing with SQL for users."] }],
    projects: [], education: [], skills: { technical: [], soft: [] }
  });
  assert.ok(review.issues.some((issue) => /"Built" already starts another bullet/.test(issue.message)));
  assert.ok(review.rewrite.some((entry) => entry.feedback.some((line) => /different verbs/.test(line))));
});

test("only real, specific tools are ever added to Skills from a job", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("Extract the skills")) {
        return { keywords: ["Artificial Intelligence", "intelligent automation workflows", "conversational experiences", "SDLC", "Kubernetes", "NoSQL"] };
      }
      if (system.includes("proofreader")) return { texts: payload.texts };
      if (system.includes("professional summary")) return { summary: "" };
      return { bullets: [] };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [], educations: [], projects: [],
      skills: [{ id: "a".repeat(24), name: "Python", skillType: "technical" }]
    },
    options: {
      sections: { summary: false, experience: true, education: true, projects: true, skills: true },
      targetTitle: "", useAi: true, addMissingKeywords: true,
      jobDescription: "Build Artificial Intelligence and intelligent automation workflows and conversational experiences across the SDLC with Kubernetes and NoSQL."
    },
    llm: fakeLlm
  });

  assert.deepEqual(result.resume.skills.added, ["Kubernetes", "NoSQL"]);
  assert.ok(!result.resume.skills.groups.some((group) => group.skills.some((skill) => /conversational|automation workflows|Artificial Intelligence/i.test(skill))));
});

test("a summary without results gets one sentence of the candidate's own measured results", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("professional summary")) {
        return { summary: "AI engineer with 4+ years of experience building agentic systems with LangGraph and MCP for enterprise teams across cloud platforms." };
      }
      if (system.includes("proofreader")) return { texts: payload.texts };
      return { bullets: [] };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [{
        id: "a".repeat(24), title: "AI Engineer", organization: "Co", location: "", start: { year: 2022 }, end: null, current: true,
        summary: "", highlights: "", projects: [], skills: [],
        bullets: ["Built MCP tools with approvals, reducing manual workflow steps by 34%", "Engineered evaluation pipelines reducing hallucinated responses by 38% in production"]
      }],
      educations: [], projects: [], skills: []
    },
    // Tailored to a job: results are quoted
    options: { sections: { summary: true, experience: false, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "AI engineer role building agents.", useAi: true },
    llm: fakeLlm
  });

  assert.match(result.resume.summary, /Results include reducing manual workflow steps by 34% and reducing hallucinated responses by 38%\.$/);
  assert.ok(result.resume.summary.length <= 620);
});

test("text gets short forms and loses buzzwords", () => {
  const { tidyText } = require("../services/resume/resumeQuality");
  const { text, buzzwords } = tidyText(
    "Leveraged an innovative Retrieval-Augmented Generation pipeline with Natural Language Processing (NLP) to build robust, scalable Large Language Models apps. Spearheaded seamless Agent2Agent work on Google Cloud Platform."
  );

  assert.equal(text, "Used a RAG pipeline with NLP to build scalable LLMs apps. Led A2A work on GCP.");
  assert.deepEqual(buzzwords.sort(), ["Leveraged", "Spearheaded", "innovative", "robust", "seamless"].sort());
});

test("a tool the job centers on is critical and is offered in Skills, never claimed in bullets", async () => {
  const { priorityOf } = require("../services/match/requirements");
  const job = "The role will primarily use Databricks Apps. Build agents using Databricks. Prefer Databricks SQL experience. Python required. Snowflake is a plus.";

  assert.equal(priorityOf(job, "Databricks"), "critical");
  assert.equal(priorityOf(job, "Python"), "required");
  assert.equal(priorityOf(job, "Snowflake"), "preferred");

  const { buildResume } = require("../services/resume/resumeAgent");
  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [{
        id: "a".repeat(24), title: "Engineer", organization: "Co", location: "", start: { year: 2022 }, end: null, current: true,
        summary: "", highlights: "", projects: [], skills: [], bullets: ["Built Python data apps for analysts"]
      }],
      educations: [], projects: [],
      skills: [{ id: "b".repeat(24), name: "Python", skillType: "technical" }]
    },
    options: {
      sections: { summary: false, experience: true, education: true, projects: true, skills: true },
      targetTitle: "", jobDescription: job, useAi: false, addMissingKeywords: false
    }
  });

  assert.ok(result.resume.skills.addedCritical.includes("Databricks"));
  assert.ok(!result.resume.skills.added.includes("Snowflake"), "only critical tools when the option is off");
  assert.ok(!result.resume.experience[0].bullets.some((bullet) => /Databricks/.test(bullet)));
});

test("a summary never pins a result on the wrong work", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("professional summary")) {
        return { summary: "AI engineer building agentic systems and enterprise AI applications across cloud platforms. Built MCP servers for enterprise APIs, reducing handling time by 37%." };
      }
      if (system.includes("proofreader")) return { texts: payload.texts };
      return { bullets: [] };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [
        { id: "a".repeat(24), title: "AI Engineer", organization: "A", location: "", start: { year: 2024 }, end: null, current: true, summary: "", highlights: "", projects: [], skills: [],
          bullets: ["Built MCP servers with approvals, reducing manual workflow steps by 34%"] },
        { id: "b".repeat(24), title: "ML Engineer", organization: "B", location: "", start: { year: 2022 }, end: { year: 2023 }, current: false, summary: "", highlights: "", projects: [], skills: [],
          bullets: ["Delivered LangChain support apps, reducing average handling time by 37%"] }
      ],
      educations: [], projects: [], skills: []
    },
    // Tailored to a job: results are quoted
    options: { sections: { summary: true, experience: false, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "AI engineer role building agents.", useAi: true },
    llm: fakeLlm
  });

  assert.ok(!/MCP servers for enterprise APIs, reducing handling time by 37%/.test(result.resume.summary));
  assert.match(result.resume.summary, /Results include reducing manual workflow steps by 34% and reducing average handling time by 37%\./);
});

test("the summary follows identity, systems, implementation, impact: 75-100 words, no employer, ends on a real result", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const payloads = [];
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("professional summary")) {
        payloads.push(payload);
        assert.ok(payload.roles.every((role) => !/Oracle|Verizon/.test(role)), "employers aren't sent");
        return { summary: [
          `AI/LLM Engineer with ${payload.yearsOfExperience} of experience developing enterprise AI applications and machine learning systems for support and operations teams.`,
          "At Oracle, built enterprise assistants that answer questions over internal documents.",
          "Built LLM-powered RAG applications and multi-agent workflows that route requests, call internal APIs and return sourced answers to support teams.",
          "Deployed these services with Python, LangGraph, FastAPI, Docker and Kubernetes on OCI, with automated evaluation before each release.",
          "Passionate about driving innovation across the enterprise."
        ].join(" ") };
      }
      if (system.includes("proofreader")) return { texts: payload.texts };
      return { bullets: [] };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [
        { id: "a".repeat(24), title: "AI Engineer", organization: "Oracle", location: "", start: { year: 2023 }, end: null, current: true, summary: "", highlights: "", projects: [], skills: [], bullets: ["Built support assistants with LangGraph, reducing manual workflow steps by 34%"] },
        { id: "b".repeat(24), title: "ML Engineer", organization: "Tata Consultancy Services (Client: Verizon)", location: "", start: { year: 2022 }, end: { year: 2023 }, current: false, summary: "", highlights: "", projects: [], skills: [], bullets: ["Modeled churn"] }
      ],
      educations: [], projects: [], skills: []
    },
    options: { sections: { summary: true, experience: false, education: true, projects: true, skills: true }, targetTitle: "AI/LLM Engineer", jobDescription: "", useAi: true },
    llm: fakeLlm
  });
  const summary = result.resume.summary;
  const words = summary.split(/\s+/).length;

  assert.match(payloads[0].emphasis, /LLMs, RAG, agents/);
  assert.match(payloads[1].feedback, /generic phrase/, "asked once more with what to fix");
  assert.ok(!/Oracle,|Passionate/.test(summary), "employer and generic sentences are dropped");
  assert.match(summary, /reducing manual workflow steps by 34%\.$/, "ends on the candidate's own result");
  assert.ok(words >= 60 && words <= 100, `${words} words`);
});

test("bullets can't describe implementation steps the user never mentioned; recent jobs get more bullets", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const fakeLlm = {
    async invokeJson(system, payload) {
      if (system.includes("proofreader")) return { texts: payload.texts };
      return {
        bullets: [
          "Developed enterprise RAG pipelines with document ingestion, chunking, embeddings, hybrid retrieval and reranking, exposing grounded answers through FastAPI endpoints for support teams.",
          "Built RAG pipelines in FastAPI over the support knowledge base with vector search, giving support agents sourced answers inside their existing ticket tool every day."
        ]
      };
    }
  };

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [{
        id: "a".repeat(24), title: "AI Engineer", organization: "Co", location: "", start: { year: 2023 }, end: null, current: true, summary: "", highlights: "", projects: [], skills: ["FastAPI"],
        bullets: ["Built RAG pipelines with vector search in FastAPI for the support knowledge base, used by support agents in their ticket tool"]
      }],
      educations: [], projects: [], skills: []
    },
    options: { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: true },
    llm: fakeLlm
  });

  // Ingestion, chunking, embeddings, hybrid retrieval and reranking aren't in the user's text
  assert.ok(result.resume.experience[0].bullets.every((bullet) => !/chunking|reranking/.test(bullet)));
  assert.ok(result.resume.experience[0].bullets.some((bullet) => /support knowledge base/.test(bullet)));
});

test("the review shows which technical areas the experience demonstrates", () => {
  const { reviewResume } = require("../services/resume/atsRules");
  const review = reviewResume({
    sections: { summary: false, skills: false }, contact: { email: "e", phone: "1", location: "X" }, summary: "",
    experience: [{ id: "x", title: "A", organization: "B", start: { year: 2022 }, current: true, bullets: [
      "Built LangGraph agents with MCP tools and human approvals for finance analysts.",
      "Deployed FastAPI services on Kubernetes with CI/CD and RBAC for internal users."
    ] }],
    projects: [], education: [], skills: { technical: [], soft: [] }
  });
  const shown = Object.fromEntries(review.areas.map((item) => [item.area, item.shown]));

  assert.equal(shown["Agentic AI"], true);
  assert.equal(shown.Backend, true);
  assert.equal(shown["Cloud/DevOps"], true);
  assert.equal(shown.Security, true);
  assert.equal(shown.MLOps, false);
});

// A fake Ollama for the Keyword Matcher and Keyword Weaver agents
const weaverLlm = (weaves) => {
  const calls = { match: 0, weave: [] };
  return {
    calls,
    async invokeJson(system, payload) {
      if (system.includes("Extract the skills")) return { keywords: [] };
      if (system.includes("proofreader")) return { texts: payload.texts };
      if (system.includes("You place job keywords")) {
        calls.match += 1;
        const ref = payload.entries[0].bullets[0].ref;
        return { placements: payload.keywords.map((keyword) => ({ keyword, ref })) };
      }
      if (system.includes("You add job keywords")) {
        calls.weave.push(payload);
        return { bullet: weaves[Math.min(calls.weave.length - 1, weaves.length - 1)] };
      }
      return { bullets: [] };
    }
  };
};

const weaverSource = (skills = []) => ({
  contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
  experiences: [{
    id: "a".repeat(24), title: "AI Engineer", organization: "Co", location: "", start: { year: 2023 }, end: null, current: true,
    summary: "Containerized the retrieval service and ran it on the team's Kubernetes cluster.", highlights: "", projects: [], skills,
    bullets: ["Built a retrieval service in Python for support agents, cutting answer lookup time by 40% across the help desk"]
  }],
  educations: [], projects: [], skills: []
});

const weaverOptions = (addMissingKeywords) => ({
  sections: { summary: false, experience: true, education: true, projects: true, skills: true },
  targetTitle: "", useAi: true, addMissingKeywords,
  jobDescription: "AI engineer. Python and Kubernetes required. Experience with Terraform is a plus."
});

test("a job keyword in the user's story is worked into the bullet as part of the work, not as a tag", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const llm = weaverLlm([
    // Rejected: a tag list at the end
    "Built a retrieval service in Python for support agents, cutting answer lookup time by 40% across the help desk, using Python, Kubernetes, retrieval.",
    "Built a retrieval service in Python for support agents and deployed it on Kubernetes, cutting answer lookup time by 40% across the help desk"
  ]);

  const result = await buildResume({ source: weaverSource(), options: weaverOptions(false), llm });

  assert.equal(llm.calls.match, 1);
  assert.match(llm.calls.weave[0].story, /Kubernetes cluster/, "the weaver reads the user's story");
  assert.match(llm.calls.weave[1].feedback, /list of tools/);
  assert.equal(result.resume.experience[0].bullets[0], "Built a retrieval service in Python for support agents and deployed it on Kubernetes, cutting answer lookup time by 40% across the help desk");
  assert.deepEqual(result.resume.keywordsWoven[0].keywords, ["Kubernetes"]);
  assert.deepEqual(result.resume.keywordsWoven[0].fromJob, []);
  // Listed in Skills too, but not flagged: the portfolio already has it
  assert.ok(result.resume.skills.technical.includes("Kubernetes"));
  assert.ok(!result.resume.skills.added.includes("Kubernetes"));
  // Terraform is only in the job and the option is off: never claimed
  assert.ok(!JSON.stringify(result.resume.experience).includes("Terraform"));
});

test("keywords only in the job are woven in only with Add missing keywords, and are flagged", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const source = weaverSource();
  source.experiences[0].summary = "";
  const llm = weaverLlm(["Built a retrieval service in Python for support agents and provisioned it with Terraform on Kubernetes, cutting answer lookup time by 40% across the help desk"]);

  const result = await buildResume({ source, options: weaverOptions(true), llm });
  const change = result.resume.keywordsWoven[0];

  assert.deepEqual(change.keywords.sort(), ["Kubernetes", "Terraform"]);
  assert.deepEqual(change.fromJob.sort(), ["Kubernetes", "Terraform"]);
  assert.equal(change.before.replace(/\.$/, ""), source.experiences[0].bullets[0]);
  assert.ok(result.resume.skills.added.includes("Terraform"), "shown so the user can remove it");
});

test("the weaver's rewrite must keep the bullet's facts and add nothing else", () => {
  const { weaveRejection } = require("../services/resume/keywordWeaver");
  const task = {
    bullet: "Built a retrieval service in Python for support agents, cutting answer lookup time by 40%",
    story: "Ran it on Kubernetes.", keywords: ["Kubernetes"], maxLength: 330
  };

  assert.match(weaveRejection("Built a retrieval service in Python for support agents, cutting lookup time by 40%", task), /leaves out Kubernetes/);
  assert.match(weaveRejection("Built a retrieval service on Kubernetes in Python for support agents, cutting answer lookup time by 55%", task), /number/);
  assert.match(weaveRejection("Built a retrieval service on Kubernetes and Kafka in Python for support agents, cutting answer lookup time by 40%", task), /Kafka/);
  assert.match(weaveRejection("Leveraged Kubernetes to build a retrieval service in Python for support agents, cutting answer lookup time by 40%", task), /start with/);
  assert.match(weaveRejection("Built a robust retrieval service on Kubernetes in Python for support agents, cutting answer lookup time by 40%", task), /buzzword/);
  assert.match(weaveRejection("Built Kubernetes clusters for teams", task), /drops too much/);
  assert.equal(weaveRejection("Built a retrieval service in Python for support agents and deployed it on Kubernetes, cutting answer lookup time by 40%", task), null);
});

test("keywords the user asks for go into work experience bullets, without buzzwords, and into Skills", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const matched = [];
  const weaves = {
    "Built fraud scoring models in Python, improving risk-scoring accuracy by 23% for payment requests.":
      "Built fraud scoring models in Python and TensorFlow, running model evaluation on holdout data before each release, improving risk-scoring accuracy by 23% for payment requests.",
    "Shipped retrieval services for support agents, cutting answer lookup time by 40%.":
      // Rejected first: buzzword
      ["Shipped robust retrieval services for support agents with GitHub and performance optimization, cutting answer lookup time by 40%.",
       "Shipped retrieval services for support agents, reviewing changes on GitHub and profiling slow queries for performance optimization, cutting answer lookup time by 40%."]
  };
  const tries = {};
  const llm = {
    async invokeJson(system, payload) {
      if (system.includes("proofreader")) return { texts: payload.texts };
      if (system.includes("You place job keywords")) {
        matched.push(payload);
        const [oracle, verizon] = payload.entries;
        return { placements: [
          { keyword: "GitHub", ref: oracle.bullets[0].ref }, { keyword: "Performance Optimization", ref: oracle.bullets[0].ref },
          { keyword: "TensorFlow", ref: verizon.bullets[0].ref }, { keyword: "Model Evaluation", ref: verizon.bullets[0].ref }
        ] };
      }
      if (system.includes("You add job keywords")) {
        const reply = weaves[payload.bullet];
        tries[payload.bullet] = (tries[payload.bullet] || 0) + 1;
        return { bullet: Array.isArray(reply) ? reply[tries[payload.bullet] - 1] : reply };
      }
      return { bullets: [] };
    }
  };
  const job = (id, organization, year, bullet) => ({
    id: id.repeat(24), title: "AI Engineer", organization, location: "", start: { year }, end: null, current: year === 2024,
    summary: "", highlights: "", projects: [], skills: [], bullets: [bullet]
  });

  const result = await buildResume({
    source: {
      contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
      experiences: [
        job("a", "Oracle", 2024, "Shipped retrieval services for support agents, cutting answer lookup time by 40%"),
        job("b", "Tata Consultancy Services (Client: Verizon)", 2022, "Built fraud scoring models in Python, improving risk-scoring accuracy by 23% for payment requests")
      ],
      educations: [],
      projects: [{ id: "c".repeat(24), title: "Side project", role: "", start: { year: 2023 }, end: null, current: false, link: "", description: "A chatbot", skills: [], bullets: ["Built a chatbot for a hackathon demo with a small team"] }],
      skills: [{ id: "d".repeat(24), name: "Python", skillType: "technical" }]
    },
    options: {
      sections: { summary: false, experience: true, education: true, projects: true, skills: true },
      targetTitle: "", jobDescription: "", useAi: true,
      includeKeywords: ["Model Evaluation", "TensorFlow", "GitHub", "Performance Optimization"]
    },
    llm
  });

  assert.equal(matched[0].entries.length, 2, "only work experience is offered, not projects");
  assert.match(result.resume.experience[0].bullets[0], /reviewing changes on GitHub and profiling slow queries for performance optimization/);
  assert.match(result.resume.experience[1].bullets[0], /TensorFlow, running model evaluation on holdout data/);
  assert.ok(result.resume.keywordsWoven.every((change) => change.byUser && !change.fromJob.length));
  assert.ok(result.resume.skills.technical.includes("TensorFlow"));
  assert.ok(result.resume.skills.technical.includes("GitHub"));
  assert.ok(!result.resume.skills.added.includes("TensorFlow"), "not flagged as from the job");
});

test("rephrasing the summary to fit its lines keeps every fact and result", async () => {
  const { refitSummary, fitRejection } = require("../services/resume/summaryFit");
  const resume = {
    summary: "", experience: [{ title: "AI Engineer", organization: "Oracle", bullets: ["Built agents with LangGraph"] }],
    projects: [], education: [], skills: { technical: ["Python", "LangGraph", "FastAPI"], soft: [] }, extras: {}
  };
  const summary = "AI engineer building LLM agents with Python and LangGraph for support teams. Deployed services with FastAPI, reducing manual workflow steps by 34%.";
  const task = { summary, targetWords: 26, allowedText: `${summary}\nPython LangGraph FastAPI`, employers: ["Oracle"] };

  assert.match(fitRejection("AI engineer building LLM agents with Python and LangGraph for support teams across products. Deployed services with FastAPI for internal users.", task), /drops the result 34%/);
  assert.match(fitRejection("AI engineer building LLM agents with Python, LangGraph and Kafka for support teams. Deployed services with FastAPI, reducing manual workflow steps by 34%.", task), /Kafka/);
  assert.match(fitRejection("AI engineer at Oracle building LLM agents with Python and LangGraph for support teams. Deployed services with FastAPI, reducing manual workflow steps by 34%.", task), /employer/);

  const longer = "AI engineer building LLM agents with Python and LangGraph that route support requests for support teams. Deployed these services with FastAPI, reducing manual workflow steps by 34%.";
  const replies = ["Too short.", longer];
  const llm = { async invokeJson(system, payload) { assert.equal(payload.targetWords, 28); return { summary: replies.shift() }; } };
  const result = await refitSummary({ llm, resume, summary, targetWords: 28, feedback: "The last line has only 2 words." });
  assert.equal(result.summary, longer);
});

test("revising a finished resume changes only what the instructions target, with the same checks", async () => {
  const { buildResume, reviseResume } = require("../services/resume/resumeAgent");
  const source = {
    contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
    experiences: [
      { id: "a".repeat(24), title: "AI Engineer", organization: "Oracle", location: "", start: { year: 2024 }, end: null, current: true, summary: "", highlights: "", projects: [], skills: [],
        bullets: ["Built support agents with LangGraph and FastAPI, reducing manual workflow steps by 34% for support teams"] },
      { id: "b".repeat(24), title: "ML Engineer", organization: "Verizon", location: "", start: { year: 2022 }, end: { year: 2023 }, current: false, summary: "", highlights: "", projects: [], skills: [],
        bullets: ["Built churn models with XGBoost in Python, improving retention targeting for marketing teams"] }
    ],
    educations: [], projects: [],
    skills: [{ id: "c".repeat(24), name: "Python", skillType: "technical" }, { id: "d".repeat(24), name: "Java", skillType: "technical" }]
  };
  const options = { sections: { summary: true, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: false };
  const built = await buildResume({ source, options });
  built.resume.summary = "AI engineer building LLM agents and ML models in Python for support and marketing teams, with LangGraph, FastAPI and XGBoost, reducing manual workflow steps by 34%.";
  const verizonBefore = built.resume.experience[1].bullets;

  const llm = {
    async invokeJson(system, payload) {
      if (system.includes("You plan changes")) {
        assert.equal(payload.instructions, "Make the Oracle bullet mention deployment, drop Java, and shorten the summary.");
        return { changes: [
          { ref: `experience:${"a".repeat(24)}`, change: "Mention that the agents were deployed." },
          { ref: "skills", change: "Remove Java", remove: ["Java"] },
          { ref: "summary", change: "Shorten it." },
          { ref: "experience:nope", change: "ignored" }
        ] };
      }
      // Drops the 34% result: rejected
      if (system.includes("professional summary")) return { summary: "AI engineer building LLM agents and ML models in Python for support and marketing teams with LangGraph." };
      if (system.includes("proofreader")) return { texts: payload.texts };
      assert.deepEqual(payload.feedback, ["Mention that the agents were deployed."]);
      return { bullets: ["Deployed support agents built with LangGraph and FastAPI, reducing manual workflow steps by 34% for support teams across regions."] };
    }
  };

  const progress = [];
  const result = await reviseResume({
    source, options, resume: built.resume, keywords: [], llm, onProgress: (message) => progress.push(message),
    instructions: "Make the Oracle bullet mention deployment, drop Java, and shorten the summary."
  });

  assert.match(result.resume.experience[0].bullets[0], /^Deployed support agents/);
  assert.deepEqual(result.resume.experience[1].bullets, verizonBefore, "untouched entries stay as they were");
  assert.ok(!result.resume.skills.technical.includes("Java"));
  assert.match(result.resume.summary, /34%/, "a summary that loses a result is not used");
  assert.ok(result.notes.some((note) => /Kept the summary/.test(note)));
  assert.ok(progress[0].startsWith("Revision Planner agent"));
  assert.ok(result.review && typeof result.review.score === "number");
});

test("an unclear revision asks which one is meant, then removes exactly that", async () => {
  const { buildResume, reviseResume } = require("../services/resume/resumeAgent");
  const source = {
    contact: { name: "T", email: "t@example.com", phone: "1", location: "Austin, TX" }, summary: "",
    experiences: [{ id: "a".repeat(24), title: "AI Engineer", organization: "Oracle", location: "Austin, TX", start: { year: 2024 }, end: null, current: true, summary: "", highlights: "", projects: [], skills: [],
      bullets: ["Built support agents with LangGraph and FastAPI, reducing manual workflow steps by 34% for support teams"] }],
    educations: [{ id: "b".repeat(24), institution: "UNT", degree: "MS", fieldOfStudy: "CS", location: "Denton, TX", start: { year: 2022 }, end: { year: 2023 }, current: false, grade: "", description: "", courses: [], bullets: [] }],
    projects: [], skills: []
  };
  const options = { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "", useAi: false };
  const { resume } = await buildResume({ source, options });
  let planned = 0;
  const llm = {
    async invokeJson(system, payload) {
      if (system.includes("You plan changes")) {
        planned += 1;
        // The planner over-reaches: it wants every location gone
        return { changes: [{ ref: "fields", change: "remove locations", remove: ["contact.location", "experience.location", "education.location"] }] };
      }
      if (system.includes("proofreader")) return { texts: payload.texts };
      throw new Error("nothing else should be rewritten");
    }
  };

  const asked = await reviseResume({ source, options, resume, llm, instructions: "Remove location" });
  assert.equal(planned, 0, "asked before the model plans anything");
  assert.equal(asked.question.question, "Which locations should be removed?");
  assert.deepEqual(asked.question.options, [
    "Only the location in the header", "Only the locations of jobs", "Only the locations of schools", "All locations on the resume"
  ]);

  const result = await reviseResume({
    source, options, resume, llm, instructions: "Remove location",
    clarifications: [{ question: asked.question.question, answer: "Only the location in the header" }]
  });
  assert.equal(result.resume.contact.location, "");
  assert.equal(result.resume.experience[0].location, "Austin, TX", "only what was chosen");
  assert.equal(result.resume.education[0].location, "Denton, TX");

  // Saying where is clear enough: no question
  const clear = await reviseResume({ source, options, resume, llm, instructions: "Remove the location at the top" });
  assert.equal(clear.question, undefined);
});

const SAMPLE_RESUME_TEXT = [
  "Jane Doe", "Dallas, TX | jane@example.com",
  "PROFESSIONAL SUMMARY", "AI engineer with 4+ years of experience building RAG systems and agents for enterprise teams.",
  "EXPERIENCE", "Oracle", "AI Engineer Jan 2024 – Present",
  "• Built LangGraph agents with MCP tools in Python, reducing manual steps by 34% across",
  "support teams in three regions.",
  "• Deployed FastAPI services on Kubernetes with 99.9% uptime for internal users.",
  "Verizon", "ML Engineer 03/2022 - 12/2023",
  "• Built churn models with XGBoost and PySpark for marketing teams.",
  "EDUCATION", "Master of Science in Computer Science, University of North Texas 2022 – 2023",
  "TECHNICAL SKILLS", "Languages: Python, SQL", "Cloud: AWS, Kubernetes"
].join("\n");

test("an uploaded resume's text is read into jobs, dates, bullets, education and skills", () => {
  const { parseResumeText } = require("../services/resume/resumeParser");
  const { resume, found } = parseResumeText(SAMPLE_RESUME_TEXT);

  assert.equal(found.jobs, 2);
  assert.deepEqual(resume.experience.map((item) => [item.organization, item.title, item.current]), [["Oracle", "AI Engineer", true], ["Verizon", "ML Engineer", false]]);
  assert.deepEqual(resume.experience[1].start, { year: 2022, month: 3 });
  assert.match(resume.experience[0].bullets[0], /by 34% across support teams in three regions\.$/, "a wrapped line joins its bullet");
  assert.deepEqual(resume.skills.technical, ["Python", "SQL", "AWS", "Kubernetes"]);
  assert.match(resume.education[0].degree, /Master of Science/);
});

test("comparing an uploaded DOCX resume with a job gives the match", async () => {
  const JSZip = require("jszip");
  const zip = new JSZip();
  const paragraphs = SAMPLE_RESUME_TEXT.split("\n").map((line) => `<w:p><w:r><w:t>${line.replace(/&/g, "&amp;")}</w:t></w:r></w:p>`).join("");
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", `<w:document><w:body>${paragraphs}</w:body></w:document>`);
  const docx = await zip.generateAsync({ type: "nodebuffer" });
  const job = "We need an AI engineer with Python, LangGraph and Kubernetes experience to build agents. Snowflake is a plus. A master's degree is preferred.";

  const response = await agent.post("/api/resume/compare")
    .field("jobDescription", job)
    .attach("file", docx, "resume.docx")
    .expect(200);

  const { match, found } = response.body;
  assert.equal(found.jobs, 2);
  const keyword = (term) => match.keywords.items.find((item) => item.text.toLowerCase() === term);
  assert.equal(keyword("python").present, true);
  assert.equal(keyword("snowflake").present, false);
  assert.ok(match.overall > 0 && match.overall <= 100);
  assert.ok(match.categories.required.items.length > 0);

  // Plain text and RTF work; old .doc and unknown files get a clear message
  await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", Buffer.from(SAMPLE_RESUME_TEXT), "resume.txt").expect(200);
  const rtf = `{\\rtf1\\ansi{\\fonttbl\\f0 Arial;}${SAMPLE_RESUME_TEXT.split("\n").map((line) => line.replace(/[–•]/g, "-")).join("\\par ")}}`;
  const fromRtf = await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", Buffer.from(rtf, "latin1"), "resume.rtf").expect(200);
  assert.equal(fromRtf.body.found.jobs, 2);
  const doc = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(300)]);
  const oldWord = await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", doc, "resume.doc").expect(400);
  assert.match(oldWord.body.message, /Save it as DOCX or PDF/);
  await agent.post("/api/resume/compare").field("jobDescription", "short").attach("file", docx, "resume.docx").expect(400);
  await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", Buffer.from([1, 2, 0, 4, 5]), "resume.bin").expect(400);
});

test("the comparison works for non-tech roles: keywords, responsibilities and qualifications", async () => {
  const { parseResumeText } = require("../services/resume/resumeParser");
  const { compareResume } = require("../services/match/resumeCompare");
  const { resume } = parseResumeText([
    "Maria Lopez", "SUMMARY", "Registered Nurse with 6 years of acute care experience.", "EXPERIENCE", "Baylor Scott & White", "Registered Nurse Jun 2019 – Present",
    "• Provided patient care for 5-6 patients per shift on a 32-bed medical-surgical unit.",
    "• Educated patients and families on discharge plans, reducing readmissions by 12%.",
    "EDUCATION", "Bachelor of Science in Nursing, UT Arlington 2015 – 2019",
    "LICENSES & CERTIFICATIONS", "RN License (Texas), BLS, ACLS"
  ].join("\n"));
  const jobDescription = [
    "Registered Nurse - Med/Surg", "Benefits", "- Great health insurance and PTO",
    "Responsibilities", "- Deliver direct patient care to assigned patients on a medical-surgical unit",
    "- Educate patients and families on care plans and discharge", "- Collaborate with physicians and the interdisciplinary team",
    "Qualifications", "- Active RN license in Texas", "- BLS and ACLS certification required", "- Bachelor of Science in Nursing (BSN)", "- 2+ years of acute care experience",
    "Preferred", "- Experience with telemetry monitoring"
  ].join("\n");

  const result = await compareResume({ resume, jobDescription });
  const item = (category, text) => result.categories[category].items.find((entry) => entry.text.includes(text));
  const keyword = (text) => result.keywords.items.find((entry) => entry.text === text);

  assert.equal(item("required", "BLS and ACLS").score, 1, "certifications in their own section count");
  assert.equal(keyword("BSN").present, true, "spelled out as Bachelor of Science in Nursing");
  assert.equal(keyword("telemetry monitoring").importance, "preferred");
  assert.equal(item("responsibilities", "Deliver direct patient care").match, "direct");
  // Teamwork the resume doesn't describe is a question to confirm, not a gap
  assert.equal(item("responsibilities", "Collaborate with physicians").match, "confirm");
  assert.equal(item("education", "Bachelor").wording, "required", "a Preferred heading below doesn't change it");
  assert.equal(item("required", "years").match, "direct");
  assert.equal(item("domain", "Healthcare").match, "direct");
  assert.ok(result.eligibility.every((entry) => entry.status === "Met"), "the licenses are shown");
  assert.ok(!JSON.stringify(result.categories).includes("health insurance"), "benefits are not requirements");
  assert.deepEqual(result.gaps, []);
  assert.ok(result.findings.confirmable.some((entry) => entry.key === "team collaboration"));
  // Missing a preferred skill lowers only the preferred score
  assert.equal(result.categories.preferred.score, 0);
  assert.equal(result.categories.required.score, 100);
  assert.equal(result.classification, "Good");
});

test("the comparison reads contact details, role, sections and certifications", () => {
  const { parseResumeText } = require("../services/resume/resumeParser");
  const { profileOf } = require("../services/match/resumeCompare");
  const { resume } = parseResumeText([
    "Jane Doe", "Senior AI Engineer", "Dallas, TX | jane@example.com | (214) 555-0100 | linkedin.com/in/janedoe | github.com/janedoe",
    "SUMMARY", "AI engineer with 4+ years of experience building RAG systems.",
    "EXPERIENCE", "Oracle", "AI Engineer Jan 2024 – Present", "• Built LangGraph agents in Python for support teams.",
    "EDUCATION", "Master of Science in Computer Science 2022 – 2023",
    "CERTIFICATIONS", "AWS Certified Machine Learning – Specialty", "Oracle Cloud Infrastructure Generative AI Professional"
  ].join("\n"));
  const profile = Object.fromEntries(profileOf(resume, "AI Engineer - Agents\nWe build agents.").map((item) => [item.field, item]));

  assert.equal(profile.Name.value, "Jane Doe");
  assert.equal(profile.Email.value, "jane@example.com");
  assert.equal(profile.LinkedIn.value, "linkedin.com/in/janedoe");
  assert.equal(profile.GitHub.value, "github.com/janedoe");
  assert.equal(profile.Role.value, "Senior AI Engineer");
  assert.equal(profile.Role.role.level, "matches");
  assert.equal(profile.Experience.value, "1 job");
  assert.equal(profile.Projects.found, false);
  assert.equal(profile.Projects.required, false);
  assert.deepEqual(profile.Certifications.items, ["AWS Certified Machine Learning – Specialty", "Oracle Cloud Infrastructure Generative AI Professional"]);
});

test("the ATS check flags what trips up applicant tracking systems in an uploaded file", async () => {
  const JSZip = require("jszip");
  const zip = new JSZip();
  const lines = SAMPLE_RESUME_TEXT.split("\n").filter((line) => !line.includes("@"));
  const paragraphs = lines.map((line) => `<w:p><w:r><w:t>${line.replace(/&/g, "&amp;")}</w:t></w:r></w:p>`).join("");
  zip.file("[Content_Types].xml", "<Types/>");
  // A table and a text box in the body, contact details only in the page header
  zip.file("word/document.xml", `<w:document><w:body>${paragraphs}<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Skills grid</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:txbxContent><w:p><w:r><w:t>Side note</w:t></w:r></w:p></w:txbxContent></w:body></w:document>`);
  zip.file("word/header1.xml", "<w:hdr><w:p><w:r><w:t>jane@example.com | 214-555-0100</w:t></w:r></w:p></w:hdr>");
  const docx = await zip.generateAsync({ type: "nodebuffer" });
  const job = "We need an AI engineer with Python, LangGraph and Kubernetes experience to build agents. Snowflake is a plus.";

  const { body } = await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", docx, "resume.docx").expect(200);
  const status = Object.fromEntries(body.ats.checks.map((item) => [item.id, item.status]));

  assert.equal(status.file, "pass");
  assert.equal(status.contact, "fail", "the email is only in the header");
  assert.equal(status.header, "fail");
  assert.equal(status.layout, "fail", "text boxes");
  assert.equal(status.dates, "pass");
  assert.equal(status.results, "pass");
  assert.ok(body.ats.score > 0 && body.ats.score < 100);

  // What doesn't match, with what to do: most important first
  const recs = body.recommendations;
  assert.equal(recs[0].priority, 1, "parsing errors come first");
  assert.ok(recs.some((item) => item.priority === 1 && /page header/.test(item.issue)));
  const snowflake = recs.find((item) => /Snowflake/.test(item.issue));
  assert.equal(snowflake.priority, 4, "a plus is a preferred capability");
  assert.match(snowflake.recommendation, /If you've used it.*if not, don't add it/);
  assert.deepEqual(recs.map((item) => item.priority), [...recs.map((item) => item.priority)].sort((a, b) => a - b));
});

test("each comparison is saved to the log book, opens on its own, previews its file and expires after 72 hours", async () => {
  const { resumeMatchLogSchema } = require("../models/ResumeMatchLog");
  const ttl = resumeMatchLogSchema.indexes().find(([fields]) => fields.createdAt === 1);
  assert.equal(ttl[1].expireAfterSeconds, 72 * 60 * 60);

  const job = "AI Engineer\nWe need an AI engineer with Python, LangGraph and Kubernetes experience to build agents. Snowflake is a plus.";
  const file = Buffer.from(SAMPLE_RESUME_TEXT);
  const compared = await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", file, "jane_resume.txt").expect(200);
  const { logId } = compared.body;
  assert.match(logId, /^[a-f0-9]{24}$/);
  assert.match(compared.body.text, /PROFESSIONAL SUMMARY/, "the text comes back for Preview");

  const { body: list } = await agent.get("/api/resume/match-logs").expect(200);
  const entry = list.logs.find((log) => log.id === logId);
  assert.equal(entry.fileName, "jane_resume.txt");
  assert.equal(entry.jobTitle, "AI Engineer");
  assert.equal(entry.candidateName, "Jane Doe");
  assert.equal(list.lifetimeHours, 72);
  assert.equal(new Date(entry.expiresAt) - new Date(entry.createdAt), 72 * 60 * 60 * 1000);
  assert.equal(entry.file, undefined, "the list never carries files");

  const { body: detail } = await agent.get(`/api/resume/match-logs/${logId}`).expect(200);
  assert.equal(detail.log.result.match.overall, compared.body.match.overall);
  assert.ok(detail.log.result.recommendations.length);
  assert.equal(detail.log.jobDescription, job);

  const fileResponse = await agent.get(`/api/resume/match-logs/${logId}/file`).buffer(true).parse((res, done) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => done(null, Buffer.concat(chunks)));
  }).expect(200);
  assert.equal(fileResponse.headers["content-type"].split(";")[0], "text/plain");
  assert.ok(fileResponse.body.equals(file));

  await agent.get("/api/resume/match-logs/not-an-id").expect(404);
  await agent.delete(`/api/resume/match-logs/${logId}`).expect(200);
  await agent.get(`/api/resume/match-logs/${logId}`).expect(404);
});

test("JobPilot reads the title and company for the form, and saves typed ones with the comparison", async () => {
  const { body: info } = await agent.post("/api/resume/job-info").send({ jobDescription: "Senior Data Engineer at Acme Health\nRequirements\n- Python and SQL" }).expect(200);
  assert.equal(info.title, "Senior Data Engineer");
  assert.equal(info.company, "Acme Health");

  const job = "Senior Data Engineer at Acme Health\nRequirements\n- Experience with Python and SQL for data pipelines and reporting";
  const compared = await agent.post("/api/resume/compare").field("jobDescription", job).field("company", "Acme Health Partners").field("jobTitle", "Staff Data Engineer")
    .attach("file", Buffer.from(SAMPLE_RESUME_TEXT), "jane.txt").expect(200);
  assert.equal(compared.body.match.header.company, "Acme Health Partners");
  assert.equal(compared.body.match.header.role, "Staff Data Engineer");
  const { body: list } = await agent.get("/api/resume/match-logs").expect(200);
  const entry = list.logs.find((log) => log.id === compared.body.logId);
  assert.equal(entry.company, "Acme Health Partners");
  assert.equal(entry.jobTitle, "Staff Data Engineer");
  await agent.delete(`/api/resume/match-logs/${compared.body.logId}`).expect(200);
});

test("confirmation answers re-score a saved comparison; unknown questions are ignored", async () => {
  const job = "Engineer\nRequirements\n- Basic Git / version control\n- Experience in Agile environments\n- Experience with Python";
  const resumeText = ["Jane Doe", "Engineer", "jane@example.com | linkedin.com/in/jane", "SUMMARY", "Engineer who ships Python services with automated pipelines and weekly releases.",
    "EXPERIENCE", "Acme Corp", "Engineer Jan 2020 – Present",
    "• Built GitHub Actions CI/CD pipelines that deploy Python services to production for 3 teams.",
    "• Shipped weekly releases of the billing API with 99.9% uptime and on-call support.",
    "EDUCATION", "B.S. Computer Science, State University 2015 – 2019"].join("\n");
  const compared = await agent.post("/api/resume/compare").field("jobDescription", job).attach("file", Buffer.from(resumeText), "jane.txt").expect(200);
  const { logId } = compared.body;
  const keys = compared.body.match.findings.confirmable.map((entry) => entry.key);
  assert.ok(keys.includes("git"), keys.join(", "));
  assert.ok(keys.includes("agile"), keys.join(", "));

  const before = compared.body.match.overall;
  const { body } = await agent.post(`/api/resume/match-logs/${logId}/confirm`).send({ confirmations: { agile: "yes", git: "no", "made up": "yes" } }).expect(200);
  assert.deepEqual(body.confirmations, { agile: "yes", git: "no" }, "only known questions are kept");
  const agile = body.match.categories.required.items.find((item) => /Agile/.test(item.text));
  assert.equal(agile.terms[0].match, "confirmed");
  const git = body.match.categories.required.items.find((item) => /Git/.test(item.text)).terms.find((term) => term.term === "Git");
  assert.notEqual(git.match, "inferred", "a No removes the inference");
  // Agile yes and Git no: the candidate-informed score changes; the resume-only one is kept apart
  assert.notEqual(body.match.overall, before);
  assert.equal(body.match.resumeOnly.overall, before);

  // Saved: the log entry carries the answers; its score stays resume-only
  const { body: detail } = await agent.get(`/api/resume/match-logs/${logId}`).expect(200);
  assert.equal(detail.log.overall, before);
  assert.equal(detail.log.result.match.overall, body.match.overall);
  assert.equal(detail.log.confirmations.agile, "yes");
  // Clearing an answer
  const { body: cleared } = await agent.post(`/api/resume/match-logs/${logId}/confirm`).send({ confirmations: { agile: null } }).expect(200);
  assert.equal(cleared.confirmations.agile, undefined);
  await agent.post(`/api/resume/match-logs/${logId}/confirm`).send({ confirmations: "yes" }).expect(400);
  await agent.delete(`/api/resume/match-logs/${logId}`).expect(200);
});

test("the Job Match Assessment follows the scoring framework", async (t) => {
  // "Jan 2024 – Present" counts up to today, so today is fixed
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 15) });
  const { parseResumeText } = require("../services/resume/resumeParser");
  const { compareResume, capabilitiesOf } = require("../services/match/resumeCompare");
  const { resume } = parseResumeText([
    "Uday Reddy", "AI Engineer", "uday@example.com | linkedin.com/in/uday",
    "EXPERIENCE", "Oracle", "Senior AI Engineer Jan 2024 – Present",
    "• Designed and deployed RAG pipelines on OCI with FastAPI REST endpoints serving 2M requests/day.",
    "• Containerized services with Docker and set up CI/CD in GitHub Actions.",
    "PayPal", "Software Engineer | Machine Learning Jan 2021 – Dec 2023",
    "• Built fraud detection models with XGBoost and PySpark, improving accuracy by 23% for payment authorization.",
    "• Implemented RBAC and audit logging for model APIs.",
    "Acme Labs", "ML Intern Jun 2020 – Dec 2020", "• Wrote data cleaning scripts in Python.",
    "EDUCATION", "Master of Science in Computer Science 2019 – 2020"
  ].join("\n"));
  const jobDescription = [
    "Senior Data & AI Engineer at Contoso Energy", "Location: Houston, TX (Hybrid)",
    "Responsibilities", "- Design, deploy, monitor, and optimize production machine learning pipelines", "- Build data pipelines on Apache Spark and AWS Glue",
    "Requirements", "- Minimum of 8 years of experience in software or data engineering", "- Experience with Kubernetes", "- Must be authorized to work in the US",
    "Preferred", "- Familiarity with Databricks",
    "Our energy utility serves millions of electricity customers across the power grid. Candidates must pass a background check."
  ].join("\n");

  const result = await compareResume({ resume, jobDescription });
  const terms = Object.values(result.categories).flatMap((category) => category.items).flatMap((item) => item.terms || []);
  const term = (name) => terms.find((entry) => entry.term === name);

  // Header
  assert.deepEqual(result.header, { company: "Contoso Energy", role: "Senior Data & AI Engineer", location: "Houston, TX (Hybrid)", seniority: "Senior", from: { title: "job description", company: "job description" } });
  // Equivalent, related (with its consideration) and partial (doesn't prove it)
  assert.equal(term("Apache Spark").match, "equivalent");
  assert.equal(term("Apache Spark").via, "PySpark");
  assert.equal(term("AWS Glue").match, "related");
  assert.match(term("AWS Glue").note, /Glue-specific operations may not/);
  assert.equal(term("Kubernetes").match, "partial");
  assert.match(term("Kubernetes").note, /Docker shows containers, not Kubernetes/);
  assert.equal(term("Databricks").match, "related");
  // Responsibilities split into capabilities; no monitoring evidence = partial, not zero or full
  assert.deepEqual(capabilitiesOf("Design, deploy, monitor, and optimize production machine learning pipelines").verbs, ["design", "deploy", "monitor", "optimize"]);
  const pipeline = result.categories.responsibilities.items[0];
  assert.equal(pipeline.capabilities.find((item) => item.capability === "Monitor").score, 0);
  assert.ok(pipeline.score > 0 && pipeline.score < 1);
  // Years: internships aren't professional experience. Below a stated
  // minimum is a qualification gap, not an eligibility failure...
  assert.equal(result.years.other > 0, true);
  const yearsItem = result.categories.required.items.find((item) => item.kind === "years");
  assert.equal(yearsItem.status, "Below minimum");
  assert.match(yearsItem.note, /5\.8 of 8 years documented/);
  assert.deepEqual(result.blocked, []);
  // ...unless the employer makes it non-negotiable
  const strict = await compareResume({ resume, jobDescription: jobDescription.replace("Minimum of 8 years of experience in software or data engineering", "Minimum of 8 years of experience in software or data engineering (non-negotiable)") });
  assert.equal(strict.categories.required.items.find((item) => item.kind === "years").status, "Strict requirement unmet");
  assert.deepEqual(strict.blocked, ["Minimum years of experience (strict)"]);
  assert.match(strict.recommendation, /mandatory requirement isn't met/);
  // Silence isn't eligibility; background checks aren't requirements
  assert.equal(result.eligibility.find((item) => item.condition === "Work authorization").status, "Unknown");
  assert.ok(!JSON.stringify(result.categories).includes("background check"));
  // Finance experience with RBAC and audit logs transfers to a regulated energy job, without claiming energy expertise
  assert.equal(result.categories.domain.items[0].match, "partial");
  // Weights sum to 100% and the score is explained by the categories
  assert.ok(Math.abs(Object.values(result.categories).reduce((sum, category) => sum + category.weight, 0) - 1) < 0.01);
  assert.ok(Math.abs(result.overall - Object.values(result.categories).reduce((sum, category) => sum + category.contribution, 0)) <= 1);
  assert.ok(result.quality.every((check) => check.passed));
});
