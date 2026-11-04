const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";

const password = "a-long-test-password";

let mongoServer;
let reviewer;
let reviewerUrl;

const sampleResume = () => ({
  sections: { summary: true, experience: true, education: true, projects: true, skills: true },
  contact: { name: "T", email: "t@example.com", phone: "1", location: "X" },
  summary: "Engineer building data pipelines and AI systems with Python, SQL and LangGraph for analytics teams.",
  experience: [{ id: "a", title: "Engineer", organization: "Co", dates: "2022 – Present", start: { year: 2022 }, current: true, bullets: ["I worked on pipelines.", "Built LangGraph agents that cut review time by 30%."] }],
  projects: [],
  education: [],
  skills: { technical: ["Python", "LangGraph"], soft: [] },
  extras: {}
});

async function mcpClient(server) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientSide);
  return client;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // The ATS Reviewer agent on its own port, as a separate A2A service
  const { createAtsReviewerApp } = require("../a2a/atsReviewerAgent");
  await new Promise((resolve) => {
    reviewer = require("http").createServer();
    reviewer.listen(0, "127.0.0.1", () => {
      reviewerUrl = `http://127.0.0.1:${reviewer.address().port}`;
      reviewer.on("request", createAtsReviewerApp(reviewerUrl));
      resolve();
    });
  });
  process.env.A2A_REVIEWER_URL = reviewerUrl;
});

after(async () => {
  reviewer?.close();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

test("the ATS Reviewer publishes an A2A agent card and reviews over JSON-RPC", async () => {
  const card = await (await fetch(`${reviewerUrl}/.well-known/agent-card.json`)).json();
  assert.equal(card.name, "ATS Reviewer");
  assert.equal(card.supportedInterfaces[0].protocolBinding, "JSONRPC");
  assert.equal(card.skills[0].id, "review-resume");

  const { reviewViaA2A } = require("../a2a/atsReviewerClient");
  const review = await reviewViaA2A({ resume: sampleResume(), keywords: ["Python", "Kubernetes"] });

  assert.equal(typeof review.score, "number");
  assert.deepEqual(review.missingKeywords, ["Kubernetes"]);
  assert.ok(review.issues.some((issue) => /first-person/.test(issue.message)));
});

test("the portfolio MCP server's resume tools work for any MCP client", async () => {
  const { createPortfolioMcpServer } = require("../mcp/portfolioMcpServer");
  const client = await mcpClient(createPortfolioMcpServer());

  const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, ["check_ats", "evaluate_job_match", "find_job_keywords", "group_skills", "list_section_schemas", "search_skill_catalog"]);

  const keywords = await client.callTool({
    name: "find_job_keywords",
    arguments: { jobDescription: "Onsite in Austin, TX. $150k. Python, LangGraph, Kubernetes and Azure." }
  });
  assert.deepEqual(keywords.structuredContent.keywords, ["Python", "LangGraph", "Kubernetes", "Azure"]);

  const grouped = await client.callTool({ name: "group_skills", arguments: { technical: ["OracleSQL", "OCI", "Oracle Cloud Infrastructure", "PyTorch"] } });
  assert.deepEqual(grouped.structuredContent.technical, ["Oracle SQL", "OCI", "PyTorch"]);
  assert.ok(grouped.structuredContent.groups.length > 0);

  const ats = await client.callTool({ name: "check_ats", arguments: { resume: sampleResume(), keywords: ["Python"] } });
  assert.equal(ats.structuredContent.reviewedBy, "ATS Reviewer agent (A2A)");

  await client.close();
});

test("the resume agent gets its tools over MCP and its review from the A2A agent", async () => {
  const { buildResume } = require("../services/resume/resumeAgent");
  const source = {
    contact: { name: "T", email: "t@example.com", phone: "1", location: "X" }, summary: "",
    experiences: [{ id: "a".repeat(24), title: "Engineer", organization: "Co", location: "", start: { year: 2022 }, end: null, current: true, summary: "", highlights: "", bullets: ["Built pipelines in Python"], skills: [], projects: [] }],
    educations: [], projects: [],
    skills: [{ id: "b".repeat(24), name: "Python", skillType: "technical" }]
  };
  const options = { sections: { summary: false, experience: true, education: true, projects: true, skills: true }, targetTitle: "", jobDescription: "Python and Kubernetes", useAi: false };

  const viaAgents = await buildResume({ source, options });
  assert.equal(viaAgents.agents.reviewedBy, "ATS Reviewer agent (A2A)");
  assert.deepEqual(viaAgents.agents.mcpTools.sort(), ["check_ats", "find_job_keywords", "group_skills"]);
  assert.deepEqual(viaAgents.keywords, ["Python", "Kubernetes"]);

  // With the reviewer unreachable, the same rules run in-process and say so
  process.env.A2A_REVIEWER_URL = "http://127.0.0.1:9";
  const fallback = await buildResume({ source, options });
  process.env.A2A_REVIEWER_URL = reviewerUrl;

  assert.match(fallback.agents.reviewedBy, /built-in/);
  assert.ok(fallback.notes.some((note) => /wasn't reachable/.test(note)));
  assert.equal(fallback.review.score, viaAgents.review.score);
});

test("started for one user, the MCP server also serves their portfolio", async () => {
  const createApp = require("../app");
  const app = createApp({ sessionStore: new session.MemoryStore() });
  const registered = await request(app).post("/api/auth/register").send({
    username: "mcp_user", email: "mcp_user@example.com", password, confirmPassword: password
  }).expect(201);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "mcp_user", password }).expect(200);
  await agent.post("/api/experiences").send({ jobTitle: "AI Engineer", organization: "Example Co", startYear: 2023, currentlyWorking: true }).expect(201);

  const { runAsUser } = require("../utils/userDatabase");
  const { createPortfolioMcpServer } = require("../mcp/portfolioMcpServer");
  const user = { id: registered.body.user.id, username: "mcp_user", email: "mcp_user@example.com" };
  const client = await mcpClient(createPortfolioMcpServer({ user, run: (fn) => runAsUser(user.id, fn) }));

  const names = (await client.listTools()).tools.map((tool) => tool.name);
  assert.ok(names.includes("get_portfolio") && names.includes("build_resume"));

  const portfolio = await client.callTool({ name: "get_portfolio", arguments: {} });
  assert.deepEqual(portfolio.structuredContent.experiences.map((item) => item.title), ["AI Engineer"]);

  const built = await client.callTool({ name: "build_resume", arguments: { jobDescription: "Python", useAi: false } });
  assert.deepEqual(built.structuredContent.resume.experience.map((item) => item.title), ["AI Engineer"]);

  await client.close();
});
