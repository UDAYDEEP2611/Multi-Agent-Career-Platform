const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parseResumeText } = require("../services/resume/resumeParser");
const { compareResume } = require("../services/match/resumeCompare");
const { rewritesFor, withRewrites } = require("../services/match/rewrites");

const { resume } = parseResumeText([
  "Alex Morgan", "Data Engineer", "alex@example.com | linkedin.com/in/alexmorgan",
  "EXPERIENCE", "PayPal", "Data Engineer Jan 2019 – Present",
  "• Built fraud detection pipelines with PySpark that score 2M payments a day.",
  "• Containerized services with Docker and set up CI/CD in GitHub Actions.",
  "EDUCATION", "Master of Science in Computer Science 2017 – 2019"
].join("\n"));
const jobDescription = [
  "Data Engineer at Contoso", "Requirements",
  "- 5 years of experience in data engineering",
  "- Experience with Apache Spark", "- Experience with Kubernetes", "- Experience with Databricks"
].join("\n");

test("rewrites name what the work already shows, and nothing it doesn't", async () => {
  const details = { resume, jobDescription };
  const { suggestions, before, after } = await rewritesFor(await compareResume(details), details);
  const all = suggestions.map((item) => item.after).join(" ");
  assert.match(all, /PySpark \(Apache Spark\)/);
  // Docker isn't Kubernetes, and nothing shows Databricks
  assert.doesNotMatch(all, /Kubernetes|Databricks/);
  for (const item of suggestions) assert.ok(resume.experience.some((job) => job.bullets.includes(item.before)), "only the resume's own bullets");
  assert.ok(after.match >= before.match, `${before.match} -> ${after.match}`);
  // The rewritten resume really scores that
  assert.equal((await compareResume({ resume: withRewrites(resume, suggestions), jobDescription })).overall, after.match);
});

test("a skill the bullet only suggests is added at the end, marked to check", async () => {
  const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  const details = { resume: parseResumeText(fixture("halvik-resume.txt")).resume, jobDescription: fixture("halvik-job.txt") };
  const { suggestions, before, after } = await rewritesFor(await compareResume(details), details);
  const agile = suggestions.find((item) => item.changes.some((change) => change.term === "Agile development"));
  assert.ok(agile, JSON.stringify(suggestions.map((item) => item.changes.map((change) => change.term))));
  assert.equal(agile.check, true);
  assert.match(agile.after, /, using [^.]*Agile development\.$/);
  assert.match(agile.why.join(" "), /only if you did/);
  // Category words aren't skills: no "scikit-learn (ML libraries)"
  assert.doesNotMatch(suggestions.map((item) => item.after).join(" "), /\((?:ML libraries|DevOps tools|agentic frameworks)\)/);
  assert.ok(after.match > before.match, `${before.match} -> ${after.match}`);
});

test("a name with a version stays whole, and plurals still match", () => {
  const { suggestRewrites } = require("../services/match/rewrites");
  const bullets = ["Built a GPT-4 note search assistant.", "Shipped weekly release trains."];
  const match = { categories: { required: { items: [{ text: "LLMs and Agile", terms: [
    { term: "LLMs", match: "equivalent", via: "GPT", evidence: [{ text: bullets[0] }] },
    { term: "Agile", match: "confirm", via: "releases", evidence: [{ text: bullets[1] }] }
  ] }] } } };
  assert.deepEqual(suggestRewrites(match, { experience: [{ bullets }] }).map((item) => item.after), [
    "Built a GPT-4 (LLMs) note search assistant.",
    "Shipped weekly release trains, using Agile."
  ]);
});
