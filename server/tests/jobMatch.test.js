const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.A2A_REVIEWER_URL = "off";

const { evaluateJobMatch } = require("../services/match/jobMatchAgent");
const { experienceYears } = require("../services/match/evidence");
const { scoreMatch } = require("../services/match/matchModel");
const { mergeAiRequirements } = require("../services/match/requirements");

const resume = () => ({
  targetTitle: "",
  summary: "Engineer building AI systems.",
  experience: [
    {
      title: "AI Engineer", organization: "Acme", start: { year: 2023, month: 1 }, end: null, current: true,
      bullets: [
        "Built FastAPI services deployed on Kubernetes with monitoring and tests.",
        "Built LangGraph agents for support search."
      ]
    },
    {
      title: "ML Engineer", organization: "Beta", start: { year: 2021, month: 6 }, end: { year: 2023, month: 3 }, current: false,
      bullets: ["Partnered with product managers to ship a ranking model."]
    }
  ],
  projects: [],
  education: [{ degree: "Master of Science", fieldOfStudy: "Computer Science" }],
  skills: { technical: ["Python", "FastAPI", "Kubernetes", "LangGraph", "Terraform"], soft: [] }
});

const levelOf = (match, text) => match.requirements.find((item) => item.text === text)?.level;

test("evidence separates listed skills from demonstrated and strong experience", async () => {
  const match = await evaluateJobMatch({
    resume: resume(),
    jobDescription: "Need FastAPI, LangGraph, Terraform and AWS. Work with product managers."
  });

  assert.equal(levelOf(match, "FastAPI"), "strong", "in a bullet with deployment, monitoring and tests");
  assert.equal(levelOf(match, "LangGraph"), "demonstrated", "in one plain bullet");
  assert.equal(levelOf(match, "Terraform"), "partial", "only in the Skills list");
  assert.equal(levelOf(match, "AWS"), "missing");
  assert.match(match.requirements.find((item) => item.text === "AWS").detail, /isn't proof/);
  assert.equal(levelOf(match, "Collaboration with product and business stakeholders"), "demonstrated");
  assert.deepEqual(match.counts, { strong: 1, demonstrated: 2, partial: 1, missing: 1 });
});

test("years of experience count overlapping jobs once, from real dates", () => {
  const now = new Date(2026, 9, 1); // October 2026
  const years = experienceYears([
    { start: { year: 2023, month: 1 }, end: null, current: true },
    { start: { year: 2021, month: 6 }, end: { year: 2023, month: 3 }, current: false },
    { start: { year: 2022, month: 1 }, end: { year: 2022, month: 6 }, current: false }
  ], now);
  // June 2021 to October 2026 = 65 months
  assert.equal(years, 5.4);
  assert.equal(experienceYears([{ start: { year: 2024 }, end: null, current: false }], now), 0, "no end date, not counted");
});

test("qualifications are checked against computed years and degree", async () => {
  const match = await evaluateJobMatch({
    resume: resume(),
    jobDescription: "8+ years of experience with Python. Bachelor's degree in Computer Science required."
  });
  const years = match.requirements.find((item) => item.kind === "years");
  const degree = match.requirements.find((item) => item.kind === "degree");

  assert.equal(years.minYears, 8);
  assert.ok(years.score < 1 && years.score > 0.5);
  assert.match(years.detail, /overlapping jobs counted once/);
  assert.equal(degree.level, "strong", "a master's meets a bachelor's requirement");
});

test("the score is a weighted average of categories, ignoring categories the job doesn't ask about", () => {
  const requirements = [
    { category: "core_ai_ml", importance: "required", score: 1 },
    { category: "core_ai_ml", importance: "preferred", score: 0 },
    { category: "software_engineering", importance: "required", score: 0.4 }
  ];
  const { overall, categories } = scoreMatch(requirements);

  // Core: (2*1 + 1*0) / 3 = 67%; Software: 40%; weights 30 and 20 -> 56%
  assert.equal(categories.find((c) => c.id === "core_ai_ml").score, 67);
  assert.equal(categories.find((c) => c.id === "security_governance").score, null);
  assert.equal(overall, 56);
  assert.equal(scoreMatch(requirements, { software_engineering: 0 }).overall, 67, "weights are adjustable");
});

test("AI-found requirements are kept only for known skills that appear in the job", () => {
  const job = "AI Engineer in Boston. Build agents with LangGraph in Go and design ML systems.";
  const merged = mergeAiRequirements([], [
    { text: "Agent frameworks", category: "core_ai_ml", terms: ["LangGraph"], importance: "required" },
    { text: "Go services", category: "software_engineering", terms: ["Go"], importance: "preferred" },
    { text: "Invented skill", category: "core_ai_ml", terms: ["Kubernetes"], importance: "required" },
    { text: "Title", category: "core_ai_ml", terms: ["AI Engineer"], importance: "required" },
    { text: "Place", category: "cloud_mlops", terms: ["Boston"], importance: "required" },
    { text: "Loose words", category: "core_ai_ml", terms: ["ML", "systems"], importance: "required" },
    { text: "Behavior", category: "product_collaboration", terms: ["LangGraph"], importance: "required" },
    { text: "Bad category", category: "made_up", terms: ["LangGraph"], importance: "required" }
  ], job);

  // "ML" in "design ML systems" is a real requirement, named in full; "systems" isn't
  assert.deepEqual(merged.map((item) => [item.text, item.importance]), [
    ["LangGraph", "required"], ["Go", "preferred"], ["Machine Learning", "required"]
  ]);
});

test("recalculating with the same requirements reflects only real edits", async () => {
  const first = await evaluateJobMatch({ resume: resume(), jobDescription: "Terraform and FastAPI." });
  const again = await evaluateJobMatch({ resume: resume(), requirements: first.requirements });
  assert.equal(again.overall, first.overall, "nothing changed, same score");

  const edited = resume();
  edited.experience[0].bullets.push("Provisioned AWS infrastructure with Terraform for 3 production services.");
  const after = await evaluateJobMatch({ resume: edited, requirements: first.requirements });

  assert.equal(levelOf(after, "Terraform"), "strong");
  assert.ok(after.overall > first.overall);
});

test("related skills count as evidence, but never more than demonstrated", async () => {
  const withPgvector = resume();
  withPgvector.experience[0].bullets.push("Stored embeddings in pgvector for semantic search.");

  const match = await evaluateJobMatch({ resume: withPgvector, jobDescription: "Experience with vector databases and LLMs." });
  const vector = match.requirements.find((item) => item.text === "Vector Databases");
  const llms = match.requirements.find((item) => item.text === "LLMs");

  assert.equal(vector.level, "demonstrated");
  assert.match(vector.detail, /related work \(pgvector\)/);
  assert.equal(llms.level, "demonstrated", "LangGraph agents show LLM work");
});
