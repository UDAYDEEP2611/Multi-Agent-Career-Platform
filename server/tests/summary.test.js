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

const password = "a-long-test-password";
let mongoServer;
let agent;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  const app = require("../app")({ sessionStore: new session.MemoryStore() });

  await request(app).post("/api/auth/register").send({
    username: "summary_owner", email: "summary_owner@example.com", password, confirmPassword: password
  }).expect(201);
  agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "summary_owner", password }).expect(200);

  const job = await agent.post("/api/experiences").send({
    jobTitle: "Machine Learning Engineer", organization: "Acme Corp", startYear: 2020, currentlyWorking: true
  }).expect(201);
  await agent.post(`/api/experiences/${job.body.experience._id}/tasks`)
    .send({ description: "Cut inference costs by 27% by batching LLM requests in Python" }).expect(201);
  for (const name of ["Python", "LangGraph", "RAG", "AWS"]) await agent.post("/api/skills").send({ name }).expect(201);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const SOURCE = {
  summary: "Engineer building AI systems.",
  experiences: [{
    title: "Machine Learning Engineer", organization: "Acme Corp", start: { year: 2020, month: 1 }, end: { year: 2024, month: 6 },
    current: false, summary: "", highlights: "", skills: ["Python", "LangGraph"], projects: [],
    bullets: ["Cut inference costs by 27% by batching LLM requests in Python", "Built RAG pipelines on AWS with LangGraph agents"]
  }],
  educations: [{ institution: "State University", degree: "MS", fieldOfStudy: "CS", description: "", bullets: [] }],
  projects: [],
  skills: ["Python", "LangGraph", "RAG", "AWS"].map((name) => ({ name }))
};

const GOOD = "Machine Learning Engineer with 4+ years of experience building LLM applications and RAG pipelines. " +
  "Designs LangGraph agents in Python and deploys them on AWS for production workloads that serve real users daily. " +
  "Focuses on evaluation, monitoring and cost control so systems stay reliable as usage grows across teams, " +
  "with retrieval quality checks, prompt testing and clear dashboards for the people who depend on them. " +
  "Cut inference costs by 27% by batching LLM requests.";

test("five styled versions, each checked against the portfolio", async () => {
  const { generateSummaryVariants, STYLES } = require("../services/resume/summaryVariants");
  const styles = [];
  const llm = {
    async invokeJson(system, payload) {
      styles.push(payload.style.name);
      assert.equal(payload.yearsOfExperience, 4);
      assert.ok(payload.achievements.some((line) => line.includes("27%")));
      if (payload.style.name === "Concise") {
        return { summary: "Machine Learning Engineer with 4+ years building RAG pipelines on AWS. Builds LangGraph agents in Python for production use. Cut inference costs by 27% by batching LLM requests." };
      }
      return { summary: GOOD };
    }
  };

  const result = await generateSummaryVariants({ llm, source: SOURCE });
  assert.equal(result.variants.length, 5);
  assert.deepEqual(styles, STYLES.map((style) => style.label));
  for (const variant of result.variants) {
    assert.ok(variant.review.find((check) => check.id === "achievement").ok);
    assert.ok(variant.review.find((check) => check.id === "years").ok);
    assert.ok(variant.review.find((check) => check.id === "title").ok);
  }
  // The current one-liner is flagged on what it's missing
  const review = Object.fromEntries(result.review.map((check) => [check.id, check.ok]));
  assert.deepEqual([review.years, review.achievement, review.length], [false, false, false]);
});

test("a version that invents facts is retried, then left out", async () => {
  const { generateSummaryVariants } = require("../services/resume/summaryVariants");
  const feedback = [];
  const llm = {
    async invokeJson(system, payload) {
      if (payload.feedback) feedback.push(payload.feedback);
      if (payload.style.name === "Balanced") return { summary: GOOD.replace("27%", "45%") };
      if (payload.style.name === "Impact first") return { summary: GOOD.replace("4+", "9+") };
      if (payload.style.name === "Technical depth") return { summary: GOOD.replace("on AWS", "on Kubernetes") };
      if (payload.style.name === "Concise") return { summary: "I am a passionate engineer. I love AI. I build things at Acme Corp." };
      return { summary: GOOD };
    }
  };

  const result = await generateSummaryVariants({ llm, source: SOURCE });
  assert.deepEqual(result.variants.map((variant) => variant.id), ["targeted"]);
  assert.equal(result.notes.length, 4);
  assert.ok(feedback.some((text) => /number that isn't in the portfolio/.test(text)));
  assert.ok(feedback.some((text) => /claims 9 years/.test(text)));
  assert.ok(feedback.some((text) => /Kubernetes/.test(text)));
});

test("generating needs the local AI and validates its inputs", async () => {
  await agent.post("/api/summary/generate").send({ targetTitle: "x".repeat(121) }).expect(400);
  const refused = await agent.post("/api/summary/generate").send({ targetTitle: "ML Engineer" }).expect(503);
  assert.match(refused.body.message, /Ollama/);
});

test("the review endpoint scores a summary on title, years, skills and results", async () => {
  const { body } = await agent.post("/api/summary/review").send({ content: GOOD }).expect(200);
  assert.ok(body.review.every((check) => check.ok), JSON.stringify(body.review));
});

test("replaced summaries are kept and can be restored", async () => {
  await agent.post("/api/summary").send({ content: "First version.", origin: "Written by you" }).expect(201);
  await agent.put("/api/summary").send({ content: "Second version.", origin: "AI · Concise" }).expect(200);
  // Saving the same text again adds nothing
  await agent.put("/api/summary").send({ content: "Second version." }).expect(200);
  let { body } = await agent.put("/api/summary").send({ content: "Third version." }).expect(200);

  assert.equal(body.summary.content, "Third version.");
  assert.deepEqual(body.summary.history.map((entry) => entry.content), ["Second version.", "First version."]);
  assert.equal(body.summary.history[0].origin, "AI · Concise");

  const first = body.summary.history[1]._id;
  ({ body } = await agent.post(`/api/summary/history/${first}/restore`).expect(200));
  assert.equal(body.summary.content, "First version.");
  assert.equal(body.summary.origin, "Written by you");
  assert.deepEqual(body.summary.history.map((entry) => entry.content), ["Third version.", "Second version."]);

  ({ body } = await agent.delete(`/api/summary/history/${body.summary.history[1]._id}`).expect(200));
  assert.deepEqual(body.summary.history.map((entry) => entry.content), ["Third version."]);

  await agent.post("/api/summary/history/not-an-id/restore").expect(404);
  await agent.post(`/api/summary/history/${first}/restore`).expect(404);
});

test("a seniority the job titles don't have is removed, and style issues become warnings", async () => {
  const { generateSummaryVariants } = require("../services/resume/summaryVariants");
  const llm = {
    async invokeJson(system, payload) {
      if (payload.style.name === "Balanced") return { summary: `Senior ${GOOD}` };
      if (payload.style.name === "Concise") {
        // Two tries, both listing every skill: kept, with a warning
        return { summary: "Machine Learning Engineer with 4+ years who will lead RAG work. Proficient in Python, LangGraph, RAG, AWS, LLM, agents and more. Cut inference costs by 27% by batching LLM requests." };
      }
      return { summary: GOOD };
    }
  };

  const { variants } = await generateSummaryVariants({ llm, source: SOURCE, targetTitle: "Senior AI Engineer" });
  const balanced = variants.find((variant) => variant.id === "balanced");
  assert.ok(balanced.summary.startsWith("Machine Learning Engineer"), balanced.summary);
  const concise = variants.find((variant) => variant.id === "concise");
  assert.match(concise.summary, /will lead RAG work/);
  const wording = concise.review.find((check) => check.id === "style");
  assert.equal(wording.ok, false);
  assert.match(wording.detail, /proficient in/i);
});
