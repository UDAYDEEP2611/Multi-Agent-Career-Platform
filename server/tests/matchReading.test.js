const test = require("node:test");
const assert = require("node:assert/strict");
const { parseResumeText } = require("../services/resume/resumeParser");
const { compareResume } = require("../services/match/resumeCompare");

// A designed resume saved as PDF: title, then employer, then dates, and
// bullets with no bullet marks (wrapped lines)
const RESUME = [
  "JANE DOE", "jane@example.com", "SKILLS", "Python PySpark LangGraph", "EXPERIENCE",
  "AI Engineer | Agentic AI", "Oracle", "Aug 2022 – Present",
  "Architected a GenAI knowledge assistant on OCI Generative AI using RAG and",
  "Oracle AI Vector Search across 10TB+ of documents, cutting answer time to 30 seconds.",
  "Built LLM-powered support agents using LangChain and OpenAI function calling in production.",
  "Software Engineer | Machine Learning", "Paypal", "Jan 2021 – Jul 2022",
  "Developed and deployed fraud detection models using XGBoost on Kafka streams.",
  "EDUCATION", "MS in Computer Science"
].join("\n");

test("a title-first job with unmarked bullets is read as title, employer and bullets", () => {
  const [oracle, paypal] = parseResumeText(RESUME).resume.experience;
  assert.equal(oracle.title, "AI Engineer | Agentic AI");
  assert.equal(oracle.organization, "Oracle");
  assert.equal(oracle.bullets.length, 2);
  assert.match(oracle.bullets[0], /^Architected .* Oracle AI Vector Search/);
  assert.equal(paypal.organization, "Paypal");
  assert.equal(paypal.bullets.length, 1);
});

test("written-out years count as a years requirement, and example tools aren't extra asks", async () => {
  const { resume } = parseResumeText(RESUME);
  const jobDescription = [
    "Requirements:",
    "- Two (2) to four (4) years of hands-on experience building and shipping software, data, or AI/ML applications in production",
    "- Hands-on exposure to building applications with large language models or generative AI APIs (e.g., Claude, OpenAI, Azure OpenAI, or similar)"
  ].join("\n");
  const match = await compareResume({ resume, jobDescription });
  const items = Object.values(match.categories).flatMap((category) => category.items || []);
  const years = items.find((item) => item.kind === "years");
  assert.ok(years, "the years line is measured as years");
  assert.equal(years.years.requested, 2);
  assert.equal(years.status, "Met");
  const llm = items.find((item) => /exposure/.test(item.text));
  assert.equal(llm.score, 1);
});
