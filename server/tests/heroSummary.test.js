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
    username: "hero_owner", email: "hero_owner@example.com", password, confirmPassword: password
  }).expect(201);
  agent = request.agent(app);
  await agent.post("/api/auth/login").send({ identifier: "hero_owner", password }).expect(200);
  await agent.post("/api/summary").send({ content: "AI Engineer building LLM systems with Python and RAG." }).expect(201);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const SOURCE = {
  summary: "AI Engineer and Data Scientist with 4+ years building production AI systems, RAG pipelines and LangGraph agents on AWS.",
  experiences: [{
    title: "AI Engineer", organization: "Acme Corp", start: { year: 2020, month: 1 }, end: { year: 2024, month: 6 },
    current: false, summary: "", highlights: "", skills: ["Python", "LangGraph"], projects: [],
    bullets: ["Cut inference costs by 27% by batching LLM requests in Python", "Built RAG pipelines on AWS with LangGraph agents"]
  }],
  educations: [{ institution: "State University", degree: "MS", fieldOfStudy: "CS", description: "", bullets: [] }],
  projects: [],
  skills: ["Python", "LangGraph", "RAG", "AWS", "LLMs"].map((name) => ({ name }))
};

const CORE = { identity: "AI Engineer", builds: "production AI systems and RAG pipelines", focusSkills: ["LangGraph", "RAG", "AWS"], proof: "Cut inference costs by 27%", direction: "" };

// A fake model: answers the grasp prompt with CORE and each design with a
// scripted reply. Designs are told apart by their voice; attempt counts the
// calls for that design, to test rewrites.
const { HERO_VOICES } = require("../services/portfolio/heroVoices");
const idOfVoice = (voice) => Object.keys(HERO_VOICES).find((id) => HERO_VOICES[id].voice === voice);

function fakeLlm(writeFor) {
  const calls = [];
  const attempts = {};
  return {
    calls,
    async invokeJson(system, payload) {
      calls.push(payload);
      if (system.startsWith("You read")) return CORE;
      const id = idOfVoice(payload.design.voice);
      attempts[id] = (attempts[id] || 0) + 1;
      return { summary: writeFor(id, attempts[id], payload) };
    }
  };
}

test("each design gets its own summary, checked against the portfolio", async () => {
  const { writeHeroSummaries } = require("../services/portfolio/heroSummaryAgent");
  const texts = {
    mono: "Builds production AI systems and RAG pipelines. Ships LangGraph agents on AWS that cut inference costs by 27%.",
    gazette: "Ships LangGraph agents and retrieval pipelines on AWS, trimming inference costs by 27% through batched LLM calls."
  };
  const llm = fakeLlm((id) => texts[id]);
  const progress = [];

  const result = await writeHeroSummaries({
    llm, source: SOURCE, headline: "AI Engineer | GenAI", designIds: ["mono", "gazette"], onProgress: (m) => progress.push(m)
  });

  assert.deepEqual(result.summaries, texts);
  assert.deepEqual(result.notes, []);
  assert.deepEqual(result.core.focusSkills, ["LangGraph", "RAG", "AWS"]);
  // One call per design, each with its voice, word range, angle and own piece of work
  assert.equal(llm.calls.length, 3);
  assert.match(llm.calls[1].design.voice, /Minimal/);
  assert.equal(llm.calls[1].design.words, "16 to 24");
  assert.notEqual(llm.calls[1].design.angle, llm.calls[2].design.angle);
  // The first builds on what the candidate builds, the second on a result
  assert.deepEqual(llm.calls[1].facts, { identity: "AI Engineer", builds: CORE.builds, skills: ["LangGraph", "RAG", "AWS"] });
  assert.match(llm.calls[2].facts.result, /batching LLM requests/);
  assert.equal(llm.calls[2].facts.builds, undefined);
  // The second design is told how the first one opened
  assert.deepEqual(llm.calls[2].avoidOpenings, ["Builds production AI systems"]);
  assert.ok(progress.some((m) => /Reading your summary/.test(m)));
});

test("a draft with invented facts is rewritten, then left out if it never passes", async () => {
  const { writeHeroSummaries } = require("../services/portfolio/heroSummaryAgent");
  const good = "Builds production AI systems and RAG pipelines. Ships LangGraph agents on AWS that cut inference costs by 27%.";
  // zen invents a number first and is fixed on the rewrite; swiss never is
  const llm = fakeLlm((id, attempt) => {
    if (id === "zen") return attempt === 1 ? "Quiet AI work. Ninety models, 99% uptime, LangGraph agents on AWS." : "Quiet, careful AI work: LangGraph agents and RAG pipelines on AWS.";
    if (id === "swiss") return "Kubernetes and Terraform platforms for global banks, built at scale.";
    return good;
  });

  const result = await writeHeroSummaries({ llm, source: SOURCE, designIds: ["mono", "zen", "swiss"] });

  assert.equal(result.summaries.mono, good);
  assert.match(result.summaries.zen, /^Quiet, careful/);
  assert.equal(result.summaries.swiss, undefined);
  assert.match(result.notes.join(" "), /swiss: left out because it names tools not in the portfolio/);
  // The rewrite carried the reason it failed
  assert.ok(llm.calls.some((payload) => /isn't in the portfolio/.test(payload.feedback || "")));
});

test("a draft a little too long loses whole sentences, never half of one", () => {
  const { fitLength } = require("../services/portfolio/heroSummaryAgent");
  const long = "Builds production AI systems and RAG pipelines on AWS. Ships LangGraph agents that cut inference costs by 27%. " +
    "Also writes evaluation suites, dashboards and documentation for the teams that run them every single day.";
  assert.equal(fitLength(long, "mono"), "Builds production AI systems and RAG pipelines on AWS. Ships LangGraph agents that cut inference costs by 27%.");
  assert.equal(fitLength("One very long sentence ".repeat(10).trim(), "mono"), "One very long sentence ".repeat(10).trim());
});

test("common filler is swapped for plain words instead of failing the draft", () => {
  const { plainWords } = require("../services/portfolio/heroSummaryAgent");
  assert.equal(plainWords("A seasoned engineer utilizing RAG."), "An engineer using RAG.");
  assert.equal(plainWords("An experienced AI Engineer leveraging LangGraph."), "An AI Engineer using LangGraph.");
  assert.equal(plainWords("Builds an LLM gateway."), "Builds an LLM gateway.");
  assert.equal(plainWords("Proficient in RAG, with expertise in LangGraph."), "Skilled in RAG, with work in LangGraph.");
});

test("the checks catch copies, first person, years and length", () => {
  const { draftProblem, factsOf } = require("../services/portfolio/heroSummaryAgent");
  const facts = factsOf(SOURCE, "AI Engineer", []);
  const text = "Builds production AI systems and RAG pipelines. Ships LangGraph agents on AWS that cut inference costs by 27%.";

  assert.equal(draftProblem(text, "mono", facts), null);
  assert.match(draftProblem(text, "slate", facts, [{ id: "mono", text }]), /almost the same as the mono/);
  assert.match(draftProblem("I build production AI systems and RAG pipelines with LangGraph agents on AWS daily.", "mono", facts), /first-person/);
  assert.match(draftProblem("Brings 9+ years of building production RAG pipelines and LangGraph agents on AWS.", "mono", facts), /claims 9 years/);
  assert.match(draftProblem("Builds AI.", "mono", facts), /has 2 words/);
  assert.match(draftProblem("Leads a team of engineers shipping production RAG pipelines and LangGraph agents on AWS.", "mono", facts), /claims "Leads a team of engineers"/);
  assert.match(draftProblem("Minimal and exact sentences with no adjectives, plain words and RAG pipelines.", "mono", facts), /copies the design's voice/);
  assert.match(draftProblem("Ships Python, LangGraph, RAG, AWS and LLMs work for production AI systems daily.", "mono", facts), /names 5 skills/);
  assert.match(draftProblem("Builds production RAG pipelines and LangGraph agents on AWS for clients worldwide.", "mono", facts), /mentions "clients"/);
  assert.match(draftProblem("Subject solves unspecified team or user problems with this outcome, daily and calmly.", "mono", facts), /talks about the instructions/);
  assert.match(draftProblem("Brings a calm and polished demeanor to the table, every single day of the week.", "mono", facts), /nothing concrete/);
  assert.match(draftProblem("AI Systems Architect shipping production RAG pipelines and LangGraph agents on AWS.", "mono", facts), /"AI Systems Architect", which isn't a title/);
  assert.match(draftProblem("A decade-long journey building production RAG pipelines and LangGraph agents on AWS.", "mono", facts), /decade/);
  assert.match(draftProblem("Builds production AI systems at Acme Corp with LangGraph agents and RAG pipelines on AWS.", "mono", facts), /employer/);
});

test("summaries are saved per design, show in the showcase and can be removed", async () => {
  let { body } = await agent.get("/api/portfolio/showcase").expect(200);
  assert.deepEqual(body.portfolio.heroSummaries, {});

  ({ body } = await agent.put("/api/portfolio/hero-summaries/zen").send({ text: "  Calm,   careful AI work. " }).expect(200));
  assert.deepEqual(body.heroSummaries.zen, { ...body.heroSummaries.zen, text: "Calm, careful AI work.", origin: "Edited by you", stale: false });

  await agent.put("/api/portfolio/hero-summaries/mono").send({ text: "Builds LLM systems." }).expect(200);
  ({ body } = await agent.get("/api/portfolio/showcase").expect(200));
  assert.deepEqual(Object.keys(body.portfolio.heroSummaries).sort(), ["mono", "zen"]);

  ({ body } = await agent.delete("/api/portfolio/hero-summaries/zen").expect(200));
  assert.deepEqual(Object.keys(body.heroSummaries), ["mono"]);
  ({ body } = await agent.delete("/api/portfolio/hero-summaries").expect(200));
  assert.deepEqual(body.heroSummaries, {});
});

test("bad requests are refused", async () => {
  await agent.put("/api/portfolio/hero-summaries/not-a-design").send({ text: "Hi there" }).expect(404);
  await agent.put("/api/portfolio/hero-summaries/zen").send({ text: "" }).expect(400);
  await agent.put("/api/portfolio/hero-summaries/zen").send({ text: "x".repeat(401) }).expect(400);
  await agent.post("/api/portfolio/hero-summaries/generate").send({ designIds: ["nope"] }).expect(400);
  // The AI isn't running in tests
  const { body } = await agent.post("/api/portfolio/hero-summaries/generate").send({ designIds: ["zen"] }).expect(503);
  assert.match(body.message, /Ollama/);
});

test("the resume summary has its own brief: title, years, key skills and the strongest result", async () => {
  const { writeHeroSummaries } = require("../services/portfolio/heroSummaryAgent");
  const text = "AI Engineer with 4+ years building production AI systems, from RAG pipelines to LangGraph agents running on AWS. " +
    "Designs retrieval, evaluation and deployment for teams that rely on them every day. " +
    "Works in Python and LangGraph from prototype to monitored production service. Cut inference costs by 27% by batching LLM requests.";
  const llm = fakeLlm(() => text);
  const result = await writeHeroSummaries({ llm, source: SOURCE, designIds: ["resume"] });
  assert.equal(result.summaries.resume, text);
  const brief = llm.calls[1];
  assert.match(brief.design.angle, /job title and years/);
  assert.equal(brief.design.words, "38 to 70");
  assert.equal(brief.yearsOfExperience, 4);
  assert.equal(brief.facts.result, "Cut inference costs by 27%");
  assert.deepEqual(brief.facts.skills, ["LangGraph", "RAG", "AWS"]);
});

test("a copied \"N+ years\" becomes the real number, and key skills lead the resume summary", async () => {
  const { withRealYears, writeHeroSummaries } = require("../services/portfolio/heroSummaryAgent");
  assert.equal(withRealYears("AI Engineer with N+ years of experience building agents.", 5), "AI Engineer with 5+ years of experience building agents.");
  assert.equal(withRealYears("AI Engineer with N+ years of experience, building agents.", null), "AI Engineer building agents.");

  const source = { ...SOURCE, skills: [{ name: "Python" }, { name: "LangGraph" }, { name: "RAG", isImportant: true }, { name: "AWS", isImportant: true }, { name: "LLMs" }] };
  const llm = fakeLlm(() => "");
  await writeHeroSummaries({ llm, source, designIds: ["resume"] });
  assert.deepEqual(llm.calls[1].facts.skills.slice(0, 2), ["RAG", "AWS"]);
});

test("the resume summary is 3 or 4 sentences", () => {
  const { draftProblem, factsOf, fitLength } = require("../services/portfolio/heroSummaryAgent");
  const facts = factsOf(SOURCE, "AI Engineer", []);
  const two = "AI Engineer with 4+ years building production RAG pipelines and LangGraph agents on AWS for the teams that depend on them every day, from prototype to monitored service. Cut inference costs by 27% by batching LLM requests in Python and shipping careful evaluation and monitoring.";
  assert.match(draftProblem(two, "resume", facts), /has 2 sentences; write 3 or 4/);
  const six = "AI Engineer with 4+ years. Builds RAG pipelines. Ships LangGraph agents on AWS. Works in Python every day. Cut inference costs by 27%. Mentors the team on evaluation.";
  assert.equal(fitLength(six, "resume").split(/(?<=[.!?])\s+/).length, 4);
});
