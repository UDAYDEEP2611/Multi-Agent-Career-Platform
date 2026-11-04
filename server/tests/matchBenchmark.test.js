const { test } = require("node:test");
const assert = require("node:assert/strict");
const JSZip = require("jszip");
const { parseResumeText, readResume } = require("../services/resume/resumeParser");
const { compareResume, matchTerm } = require("../services/match/resumeCompare");

// Scoring benchmark for JobPilot. The expected outcomes come from the
// matching framework's rules and examples (what a careful human reviewer
// would conclude), not from running the engine: each case states a bound or
// direction ("equivalent >= 90%", "Docker for Kubernetes administration ~0").
// Review these expectations when the framework changes; don't regenerate them
// from engine output.

// A resume from plain lines (one job per entry: [organization, "Title Mon YYYY – Mon YYYY", ...bullets])
function resumeOf(jobs, extra = []) {
  const lines = ["Jane Doe", "Engineer", "jane@example.com | linkedin.com/in/jane", "EXPERIENCE"];
  for (const [organization, titleAndDates, ...bullets] of jobs) lines.push(organization, titleAndDates, ...bullets.map((bullet) => `• ${bullet}`));
  lines.push(...extra);
  return parseResumeText(lines.join("\n")).resume;
}

// The evidence matchTerm needs, built the way compareResume builds it
// term: the requirement's term, or a pattern for it ("Kubernetes" in "Kubernetes administration")
async function termScore(requirementLine, term, jobs, extra = []) {
  const result = await compareResume({ resume: resumeOf(jobs, extra), jobDescription: `Engineer\nRequirements\n- ${requirementLine}` });
  const terms = result.categories.required.items.flatMap((item) => item.terms || []);
  const found = term instanceof RegExp ? terms.find((entry) => term.test(entry.term)) : terms.find((entry) => entry.term.toLowerCase() === term.toLowerCase());
  assert.ok(found, `no term ${term} in ${terms.map((entry) => entry.term).join(", ")}`);
  return found;
}

const WORK = (bullet) => [["Acme Corp", "Engineer Jan 2020 – Present", bullet]];

// ---- Credit where it's due (no undercrediting) ----

test("exact keyword with real work: full credit, high confidence", async () => {
  const fastapi = await termScore("Experience with FastAPI", "FastAPI", WORK("Built FastAPI services deployed to production for 3 internal teams."));
  assert.equal(fastapi.match, "direct");
  assert.equal(fastapi.score, 1);
  assert.equal(fastapi.confidence, "high");
});

test("equivalent terminology gets near-full credit", async () => {
  const cases = [
    ["Experience with Apache Spark", "Apache Spark", "Built ETL jobs in PySpark processing 2TB daily."],
    ["Experience building RESTful APIs", "RESTful APIs", "Built REST endpoints with FastAPI for the billing service."],
    ["Familiarity with vector databases", "vector databases", "Built a production RAG application using pgvector."],
    ["Experience with LLM evaluation", "LLM evaluation", "Evaluated RAG answers with RAGAS before each release."],
    ["Experience with containerization", "containerization", "Containerized 12 services with Docker."]
  ];
  for (const [line, term, bullet] of cases) {
    const result = await termScore(line, term, WORK(bullet));
    assert.ok(result.score >= 0.9, `${term} from "${bullet}" scored ${result.score} (${result.match})`);
  }
});

test("strong transferable experience gets substantial credit, with its consideration stated", async () => {
  const powerBi = await termScore("Experience with Power BI", "Power BI", WORK("Built Tableau dashboards used by 40 finance analysts."));
  assert.equal(powerBi.match, "related");
  assert.ok(powerBi.score >= 0.8);
  assert.match(powerBi.note, /DAX may not/);
});

test("rephrasing the same evidence doesn't materially change the score", async () => {
  const pyspark = await termScore("Experience with Apache Spark", "Apache Spark", WORK("Built ETL jobs in PySpark."));
  const spelled = await termScore("Experience with Apache Spark", "Apache Spark", WORK("Built ETL jobs in Apache Spark using Python."));
  assert.ok(Math.abs(pyspark.score - spelled.score) < 0.06, `${pyspark.score} vs ${spelled.score}`);
});

// ---- No credit beyond the evidence (no overcrediting) ----

test("Docker doesn't satisfy expert Kubernetes administration", async () => {
  const result = await termScore("Expert-level Kubernetes administration", /kubernetes/i, WORK("Containerized services with Docker."));
  assert.ok(result.score <= 0.05, `scored ${result.score}`);
});

test("LangGraph doesn't automatically satisfy persistent agent memory", async () => {
  const result = await termScore("Experience with persistent memory for agents", /persistent memory/i, WORK("Built multi-agent workflows with LangGraph."));
  assert.ok(result.score <= 0.4, `scored ${result.score}`);
});

test("experience with one cloud doesn't satisfy another provider's architecture", async () => {
  const result = await termScore("Expert in AWS architecture", "AWS", WORK("Architected services on Azure with AKS."));
  assert.ok(result.score <= 0.1, `scored ${result.score}`);
});

test("a skill only listed earns little when proficiency is required, more when familiarity is enough", async () => {
  const skills = ["SKILLS", "Go, Python"];
  const proficient = await termScore("Proficiency in Go", "Go", WORK("Built Python services."), skills);
  const familiar = await termScore("Familiarity with Go", "Go", WORK("Built Python services."), skills);
  assert.ok(proficient.score <= 0.3, `proficient scored ${proficient.score}`);
  assert.equal(proficient.confidence, "low");
  assert.ok(familiar.score > proficient.score);
});

test("a tutorial project proves less than production work for expert depth", async () => {
  const resume = resumeOf([["Acme Corp", "Engineer Jan 2020 – Present", "Maintained internal tools."]], ["PROJECTS", "Todo App", "• Followed a tutorial to build a Kubernetes demo."]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Expert-level Kubernetes" });
  const kubernetes = result.categories.required.items[0].terms[0];
  assert.ok(kubernetes.score <= 0.5, `scored ${kubernetes.score}`);
  assert.equal(kubernetes.confidence, "low");
});

// ---- Requirements and eligibility ----

test("a missing preferred skill has a limited effect on the overall score", async () => {
  const resume = resumeOf(WORK("Built Python APIs with FastAPI and PostgreSQL, deployed on Kubernetes."));
  const base = "Engineer\nResponsibilities\n- Build and deploy Python APIs on Kubernetes\nRequirements\n- Experience with Python\n- Experience with Kubernetes\nPreferred\n- Experience with FastAPI\n- Experience with PostgreSQL";
  const without = await compareResume({ resume, jobDescription: base });
  const withMissing = await compareResume({ resume, jobDescription: `${base}\n- Experience with Snowflake` });
  assert.equal(withMissing.categories.required.score, without.categories.required.score);
  // At most that one item's share of the preferred category
  const oneItemShare = Math.ceil((withMissing.categories.preferred.weight * 100) / withMissing.categories.preferred.items.length) + 1;
  assert.ok(without.overall - withMissing.overall <= oneItemShare, `dropped ${without.overall - withMissing.overall} points (limit ${oneItemShare})`);
  assert.ok(!withMissing.gaps.some((gap) => /Snowflake/.test(gap)), "a preferred gap isn't a minimum");
});

test("a missing mandatory license is flagged, not assumed either way", async () => {
  const resume = resumeOf(WORK("Designed bridge structures for state highway projects."));
  const result = await compareResume({ resume, jobDescription: "Civil Engineer\nRequirements\n- Active PE license required\n- Experience with AutoCAD" });
  const license = result.eligibility.find((item) => /license/i.test(item.condition));
  assert.ok(license && license.status !== "Met");
  assert.ok(result.findings.eligibilityFlags.includes(license));
});

test("a requirement repeated three times counts once when semantically identical", async () => {
  const resume = resumeOf(WORK("Built Python data pipelines."));
  const once = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Python\n- Experience with Kubernetes" });
  const repeated = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Python\n- Experience with Kubernetes\n- Hands-on experience with Kubernetes\nPreferred\n- Experience with Kubernetes" });
  const counted = Object.values(repeated.categories).flatMap((category) => category.items)
    .filter((item) => !item.duplicate).flatMap((item) => (item.terms || []).map((term) => term.term)).filter((term) => /kubernetes/i.test(term));
  assert.equal(counted.length, 1, `Kubernetes counted ${counted.length} times`);
  assert.ok(Math.abs(once.overall - repeated.overall) <= 1, `${once.overall} vs ${repeated.overall}`);
});

test("the same technology in different capabilities is assessed separately", async () => {
  const resume = resumeOf(WORK("Built Python data pipelines for reporting."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Python development\n- Python-based API integration\n- Python performance optimization" });
  const items = result.categories.required.items;
  assert.equal(items.filter((item) => !item.duplicate).length, 3, "three distinct capabilities");
  // Python is shown; API integration and performance tuning aren't, so those score lower
  const development = items.find((item) => /development/.test(item.text));
  const integration = items.find((item) => /API integration/.test(item.text));
  const performance = items.find((item) => /performance/.test(item.text));
  assert.ok(integration.score < development.score, `${integration.score} vs ${development.score}`);
  assert.ok(performance.score < development.score);
  assert.match(integration.reason, /integration/);
});

test("below a years minimum is a gap; only a non-negotiable minimum is an eligibility failure", async () => {
  const resume = resumeOf([["Acme Corp", "Engineer Jan 2021 – Dec 2023", "Built Python services."]]);
  const plain = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- 5+ years of experience with Python" });
  const strict = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- 5+ years of experience with Python (strict, no exceptions)" });
  assert.equal(plain.categories.required.items[0].status, "Below minimum");
  assert.deepEqual(plain.blocked, []);
  assert.equal(strict.categories.required.items[0].status, "Strict requirement unmet");
  assert.equal(strict.blocked.length, 1);
});

test("no years requirement is invented from other numbers", async () => {
  const resume = resumeOf(WORK("Built Python services."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nAbout us\nFounded 25 years ago, we serve 3 states.\nRequirements\n- Experience with Python" });
  assert.ok(!result.categories.required.items.some((item) => item.kind === "years"));
});

test("an unfamiliar technology: Not demonstrated without evidence, Uncertain with possible evidence, never credited", async () => {
  const none = await termScore("Experience with Zorblax", "Zorblax", WORK("Built Python services."));
  assert.equal(none.match, "missing");
  assert.equal(none.unfamiliar, true);

  const resume = resumeOf(WORK("Tuned Zorbix stream processing pipelines for real-time fraud scoring."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Zorblax stream processing pipelines" });
  const term = result.categories.required.items[0].terms[0];
  assert.equal(term.match, "uncertain");
  assert.equal(term.score, 0, "uncertainty earns no provisional credit");
  assert.ok(result.findings.uncertain.length === 1, "listed for manual review");
  assert.ok(!result.findings.gaps.includes("Zorblax"), "kept apart from confirmed gaps");
});

// ---- Stability and parsing ----

test("reordering resume bullets doesn't change the score", async () => {
  const bullets = ["Built Python APIs with FastAPI.", "Deployed services on Kubernetes with monitoring in Grafana.", "Reduced query latency by 40% in PostgreSQL."];
  const jd = "Engineer\nResponsibilities\n- Design, deploy, and monitor backend services\nRequirements\n- Experience with Python and Kubernetes\nPreferred\n- Experience with PostgreSQL";
  const forward = await compareResume({ resume: resumeOf([["Acme Corp", "Engineer Jan 2020 – Present", ...bullets]]), jobDescription: jd });
  const reversed = await compareResume({ resume: resumeOf([["Acme Corp", "Engineer Jan 2020 – Present", ...[...bullets].reverse()]]), jobDescription: jd });
  assert.equal(forward.overall, reversed.overall);
});

test("the same resume as TXT, DOCX and RTF yields the same facts", async () => {
  const lines = ["Jane Doe", "EXPERIENCE", "Acme Corp", "Engineer Jan 2020 – Present", "- Built Python APIs with FastAPI.", "- Deployed services on Kubernetes.", "EDUCATION", "Bachelor of Science in Computer Science 2016 – 2020", "SKILLS", "Python, Kubernetes"];
  const zip = new JSZip();
  zip.file("[Content_Types].xml", "<Types/>");
  zip.file("word/document.xml", `<w:document><w:body>${lines.map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`);
  const docx = await zip.generateAsync({ type: "nodebuffer" });
  const rtf = Buffer.from(`{\\rtf1\\ansi{\\fonttbl\\f0 Arial;}\\f0 ${lines.map((line) => line.replace("–", "\\'96")).join("\\par ")}}`, "latin1");

  const facts = async (buffer, type) => {
    const { resume } = parseResumeText((await readResume(buffer, type)).text);
    return JSON.stringify({ jobs: resume.experience.map((item) => [item.organization, item.title, item.bullets]), skills: resume.skills.technical, education: resume.education.map((item) => item.degree) });
  };
  const fromText = await facts(Buffer.from(lines.join("\n")), "text/plain");
  assert.equal(await facts(docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), fromText);
  assert.equal(await facts(rtf, "application/rtf"), fromText);
});

test("conflicting dates and bullets under the wrong employer are parsing issues, not gaps", async () => {
  const resume = resumeOf([
    ["Oracle", "AI Engineer Jan 2024 – Present", "Built agents at Oracle."],
    ["Verizon", "ML Engineer Dec 2023 – Mar 2022", "Built Oracle Cloud agents for the Oracle team."]
  ]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Python" });
  assert.ok(result.findings.parsingIssues.some((issue) => /end before they start/.test(issue)));
  assert.ok(result.findings.parsingIssues.some((issue) => /under Verizon mentions Oracle/.test(issue)));
});

// ---- AI agents must be traceable ----

test("unsupported AI-agent claims earn no credit; verified ones are labeled", async () => {
  const resume = resumeOf(WORK("Built Python services."), []);
  resume.experience[0].bullets.push("Ran Pulsar topics for event streaming between 9 services.");
  const llm = {
    async invokeJson(system, payload) {
      if (system.includes("Extract the requirements") || system.includes("pull out what a resume should show")) return { keywords: [], responsibilities: [], qualifications: [] };
      if (system.includes("under another name")) {
        return { matches: [
          // Not in the cited bullet: rejected
          { term: payload.terms.find((term) => /Zorblax/.test(term)), bullet: 0, technology: "Zorblax Pro", relation: "equivalent" },
          // Really in the cited bullet: accepted as related, flagged for review
          { term: payload.terms.find((term) => /Kafka/.test(term)), bullet: 1, technology: "Pulsar", relation: "related" }
        ] };
      }
      if (system.includes("against a job's responsibilities")) {
        // Claims the Python bullet shows managing budgets: shares no words, so no credit
        return { matches: [{ responsibility: 0, bullet: 0, level: "strong" }] };
      }
      return {};
    }
  };
  const result = await compareResume({
    resume, llm,
    jobDescription: "Engineer\nResponsibilities\n- Manage departmental budgets and vendor contracts\nRequirements\n- Experience with Zorblax\n- Experience with Apache Kafka"
  });
  const terms = result.categories.required.items.flatMap((item) => item.terms || []);
  assert.equal(terms.find((term) => term.term === "Zorblax").score, 0);
  const kafka = terms.find((term) => /Kafka/.test(term.term));
  assert.ok(kafka.score > 0 && kafka.via);
  assert.equal(result.categories.responsibilities.items[0].score, 0);
  assert.ok(!result.categories.responsibilities.items[0].byAgent);
});

// ---- Expert-review expectations (initial; refine with real JDs and bullets) ----

test("expert review: Tableau is related for BI, but doesn't prove DAX", async () => {
  const bi = await termScore("Experience with Power BI", "Power BI", WORK("Built Tableau dashboards for finance."));
  const dax = await termScore("Experience with DAX", "DAX", WORK("Built Tableau dashboards for finance."));
  assert.equal(bi.match, "related");
  assert.equal(dax.score, 0);
  assert.match(dax.reason, /DAX/);
});

test("expert review: LangGraph alone earns 0% for persistent agent memory", async () => {
  const result = await termScore("Experience with persistent memory for agents", /persistent memory/i, WORK("Built multi-agent workflows with LangGraph."));
  assert.equal(result.score, 0);
  assert.equal(result.via, "LangGraph", "the relation is still noted");
});

test("expert review: CI/CD is partial for MLOps, only for overlapping delivery practices", async () => {
  const result = await termScore("Experience with MLOps", "MLOps", WORK("Set up CI/CD in GitHub Actions for 10 services."));
  assert.equal(result.match, "partial");
  assert.ok(result.score > 0 && result.score <= 0.4, `scored ${result.score}`);
});

test("expert review: AWS for Azure architecture is partial at most", async () => {
  const result = await termScore("Experience designing Azure architecture", "Azure", WORK("Architected data platforms on AWS."));
  assert.ok(["partial", "missing"].includes(result.match));
  assert.ok(result.score <= 0.1, `scored ${result.score}`);
});

test("expert review: financial RBAC and audit transfer to an energy job, without proving NERC CIP", async () => {
  const resume = resumeOf([["PayPal", "Engineer Jan 2020 – Present", "Implemented RBAC and audit logging for payment APIs."]]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nResponsibilities\n- Secure grid data platforms with access controls and audit logging\nRequirements\n- Experience with NERC CIP compliance\nOur energy utility runs the power grid for electricity customers." });
  const domain = result.categories.domain.items[0];
  assert.equal(domain.match, "partial");
  assert.ok(domain.score > 0.3 && domain.score < 0.75);
  assert.match(domain.note, /NERC/);
});

test("expert review: a deployed FastAPI project earns implementation credit, not automatic enterprise-scale ownership", async () => {
  const resume = resumeOf([["Acme Corp", "Engineer Jan 2020 – Present", "Maintained internal reports."]], ["PROJECTS", "Booking API", "• Built and deployed a FastAPI booking service with unit tests and CI/CD on Render."]);
  const handsOn = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with FastAPI" });
  const expert = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Expert-level FastAPI at enterprise scale" });
  const handsOnTerm = handsOn.categories.required.items[0].terms[0];
  const expertTerm = expert.categories.required.items[0].terms[0];
  assert.ok(handsOnTerm.score >= 0.9, `hands-on scored ${handsOnTerm.score}`);
  assert.ok(expertTerm.score < 1, `expert scored ${expertTerm.score}`);
  assert.match(expertTerm.note, /not independently verified/);
});

test("expert review: a job that accepts equivalent experience doesn't fail a missing degree outright", async () => {
  const resume = resumeOf([["Acme Corp", "Engineer Jan 2018 – Present", "Built Python services."]]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Bachelor's degree in Computer Science or equivalent experience\n- Experience with Python" });
  const degree = result.categories.education.items[0];
  assert.equal(degree.match, "equivalent");
  assert.ok(degree.score >= 0.8);
});

// ---- Depth boundaries ----

test("depth boundaries: working knowledge reads as familiarity, strong experience as proficiency", async () => {
  const skills = ["SKILLS", "Rust"];
  const working = await termScore("Working knowledge of Rust", "Rust", WORK("Built Python services."), skills);
  const strong = await termScore("Strong experience with Rust", "Rust", WORK("Built Python services."), skills);
  const plain = await termScore("Experience with Rust", "Rust", WORK("Built Python services."), skills);
  assert.equal(working.score, 0.7);
  assert.equal(plain.score, 0.5);
  assert.equal(strong.score, 0.3);
});

// ---- P3 checks that don't need a real resume ----

test("a malformed or failing Ollama response is handled safely and earns nothing", async () => {
  const resume = resumeOf(WORK("Built Python APIs with FastAPI."));
  const jd = "Engineer\nResponsibilities\n- Manage vendor contracts\nRequirements\n- Experience with Python\n- Experience with Zorblax";
  const baseline = await compareResume({ resume, jobDescription: jd });
  const garbage = { async invokeJson() { return { matches: [{ responsibility: "x", bullet: 99 }, null, 7], keywords: "not a list", qualifications: [{}], roleFamily: 42 }; } };
  const failing = { async invokeJson() { throw new Error("connection refused"); } };
  for (const llm of [garbage, failing]) {
    const result = await compareResume({ resume, jobDescription: jd, llm });
    assert.equal(result.overall, baseline.overall);
    assert.equal(result.categories.responsibilities.items[0].score, 0);
  }
});

test("repeated runs give identical results", async () => {
  const resume = resumeOf(WORK("Built Python APIs with FastAPI, deployed on Kubernetes with Grafana monitoring."));
  const jd = "Engineer\nResponsibilities\n- Design, deploy, and monitor APIs\nRequirements\n- 3+ years of experience with Python\n- Experience with Kubernetes\nPreferred\n- Familiarity with Terraform";
  const first = await compareResume({ resume, jobDescription: jd });
  const second = await compareResume({ resume, jobDescription: jd });
  assert.deepEqual(second, first);
});

test("the trace adds up: requirement points to categories, categories to the overall score", async () => {
  const resume = resumeOf(WORK("Built Python APIs with FastAPI, deployed on Kubernetes."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nResponsibilities\n- Build and deploy Python APIs\nRequirements\n- Experience with Python\n- Experience with Terraform\nPreferred\n- Familiarity with Databricks" });
  for (const category of Object.values(result.categories)) {
    if (category.score === null) continue;
    const points = category.items.reduce((sum, item) => sum + item.points, 0);
    assert.ok(Math.abs(points - category.contribution) <= 0.5, `${category.label}: ${points} vs ${category.contribution}`);
  }
  const total = Object.values(result.categories).reduce((sum, category) => sum + category.contribution, 0);
  assert.ok(Math.abs(total - result.overall) <= 1);
  // Every reduced credit says why
  for (const item of Object.values(result.categories).flatMap((category) => category.items)) {
    if (item.score < 1 && !item.duplicate) assert.ok(item.reason, `no reason for "${item.text}"`);
  }
});

test("Evidence-agent claims need a structured, checkable explanation", async () => {
  const resume = resumeOf(WORK("Built Python REST APIs with FastAPI for payment services."));
  // Long enough that only the agent, not word overlap, can credit it
  const jd = "Engineer\nResponsibilities\n- Implement secure token-based authentication and session management for payment services across merchant platforms";
  const claim = (overrides) => ({ async invokeJson(system) {
    if (system.includes("against a job's responsibilities")) return { matches: [{ responsibility: 0, bullet: 0, level: "strong", capability: "API development for payments", relationship: "Builds payment APIs", technologies: ["FastAPI"], unsupported: [], ...overrides }] };
    return {};
  } });

  // A technology that isn't in the bullet: rejected
  const invented = await compareResume({ resume, jobDescription: jd, llm: claim({ technologies: ["OAuth2"] }) });
  assert.ok(!invented.categories.responsibilities.items[0].byAgent);
  // No stated capability: rejected
  const vague = await compareResume({ resume, jobDescription: jd, llm: claim({ capability: "" }) });
  assert.ok(!vague.categories.responsibilities.items[0].byAgent);
  // Honest claim with an unsupported sub-capability: accepted at partial, marked for review
  const honest = await compareResume({ resume, jobDescription: jd, llm: claim({ unsupported: ["authentication"] }) });
  const item = honest.categories.responsibilities.items[0];
  assert.equal(item.byAgent, true);
  assert.equal(item.match, "partial");
  assert.equal(item.needsReview, true);
  assert.deepEqual(item.agentExplanation.unsupported, ["authentication"]);
  assert.ok(honest.findings.needsReview.length >= 1);
});

test("naming a tool doesn't satisfy a duty that asks something specific of it", async () => {
  const resume = resumeOf(WORK("Built Python REST APIs with FastAPI for payment services."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nResponsibilities\n- Build secure API authentication with OAuth2 and token rotation" });
  const duty = result.categories.responsibilities.items[0];
  assert.ok(duty.score < 0.7, `scored ${duty.score}`);
  assert.match(duty.reason, /authentication|token|secure/i);
});

// ---- Semantic stability (P3): equivalent inputs, similar results ----

test("stability: equivalent JD wording gives similar scores", async () => {
  const resume = resumeOf(WORK("Deployed Python services on Kubernetes with Helm for 5 teams."));
  const wordings = ["Experience with Kubernetes", "Experience working with Kubernetes", "Kubernetes experience", "Hands-on experience with Kubernetes"];
  const scores = [];
  for (const wording of wordings) {
    const result = await compareResume({ resume, jobDescription: `Engineer\nRequirements\n- ${wording}` });
    scores.push(result.categories.required.score);
  }
  assert.ok(Math.max(...scores) - Math.min(...scores) <= 10, `scores ${scores.join(", ")}`);
});

test("stability: bullet glyphs and layout don't change the extracted facts or score", async () => {
  const jd = "Engineer\nRequirements\n- Experience with Python and Kubernetes";
  const variants = ["•", "-", "*", "▪"].map((glyph) => parseResumeText(["Jane Doe", "EXPERIENCE", "Acme Corp", "Engineer Jan 2020 – Present", `${glyph} Built Python APIs.`, `${glyph} Deployed services on Kubernetes.`].join("\n")).resume);
  const results = await Promise.all(variants.map((resume) => compareResume({ resume, jobDescription: jd })));
  assert.equal(new Set(results.map((result) => result.overall)).size, 1, `overall ${results.map((result) => result.overall).join(", ")}`);
  assert.ok(variants.every((resume) => resume.experience[0].bullets.length === 2));
});

test("stability: different valid agent explanations for the same match give the same credit", async () => {
  const resume = resumeOf(WORK("Built Python REST APIs with FastAPI for payment services."));
  const jd = "Engineer\nResponsibilities\n- Implement secure token-based authentication and session management for payment services across merchant platforms";
  const agentSays = (capability, relationship) => ({ async invokeJson(system) {
    if (system.includes("against a job's responsibilities")) return { matches: [{ responsibility: 0, bullet: 0, level: "strong", capability, relationship, technologies: ["FastAPI"], unsupported: ["authentication"] }] };
    return {};
  } });
  const first = await compareResume({ resume, jobDescription: jd, llm: agentSays("payment API development", "Builds the payment APIs that need auth") });
  const second = await compareResume({ resume, jobDescription: jd, llm: agentSays("API work for payments", "FastAPI payment services are the surface to secure") });
  assert.equal(first.categories.responsibilities.items[0].score, second.categories.responsibilities.items[0].score);
});

test("mandatory context: generic tools can't stand in for OAuth2 authentication", async () => {
  // Records today's behavior for P3 review; the 60/40 split itself is unchanged
  const resume = resumeOf(WORK("Built Python REST APIs with FastAPI for payment services."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience implementing OAuth2 authentication for REST APIs" });
  const item = result.categories.required.items[0];
  assert.ok(item.score <= 0.6, `scored ${item.score}: ${item.reason}`);
  assert.ok(item.terms.some((term) => /oauth/i.test(term.term) && term.score === 0), "OAuth2 itself isn't demonstrated");
  // Coverage keeps the transferable REST API credit; the requirement itself isn't satisfied
  assert.equal(item.satisfaction, "Not satisfied");
  assert.ok(item.covered.includes("REST APIs"));
  assert.ok(item.unmet.some((part) => /OAuth2/i.test(part)));
});

test("satisfaction: fully shown is Satisfied, shown through a related tool is Partly satisfied", async () => {
  const direct = await compareResume({ resume: resumeOf(WORK("Built FastAPI services in production.")), jobDescription: "Engineer\nRequirements\n- Experience with FastAPI" });
  const related = await compareResume({ resume: resumeOf(WORK("Built Tableau dashboards for finance.")), jobDescription: "Engineer\nRequirements\n- Experience with Power BI" });
  assert.equal(direct.categories.required.items[0].satisfaction, "Satisfied");
  assert.equal(related.categories.required.items[0].satisfaction, "Partly satisfied");
});

// ---- Real-document review: Halvik AI/ML Engineer (sanitized fixtures) ----
// Expected outcomes are the external review's labels for this pair; they
// check each judgment, not the overall score.

const fs = require("node:fs");
const path = require("node:path");
const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
let halvik;
const halvikResult = async () => {
  halvik = halvik || await compareResume({ resume: parseResumeText(fixture("halvik-resume.txt")).resume, jobDescription: fixture("halvik-job.txt") });
  return halvik;
};
const itemsOf = (result) => Object.values(result.categories).flatMap((category) => category.items);
const itemFor = (result, pattern) => {
  const item = itemsOf(result).find((entry) => pattern.test(entry.text));
  assert.ok(item, `no requirement matching ${pattern}`);
  return item;
};
const termIn = (item, pattern) => (item.terms || []).find((term) => pattern.test(term.term));

test("Halvik: bullets stay under their own employer when a wrapped line precedes the next job", () => {
  const { resume } = parseResumeText(fixture("halvik-resume.txt"));
  assert.deepEqual(resume.experience.map((job) => [job.organization, job.bullets.length]), [["Oracle", 4], ["Verizon", 3], ["PayPal", 2]]);
  assert.ok(resume.experience[0].bullets[3].includes("prompt-injection defense"), "the wrapped line stays on Oracle's bullet");
  assert.ok(!resume.experience[1].bullets.join(" ").includes("prompt-injection"), "Verizon has no Oracle text");
  assert.equal(resume.experience[1].location, "New York, NY");
  assert.equal(resume.certifications.length, 4);
});

test("Halvik: structural headings are excluded from scoring", async () => {
  const result = await halvikResult();
  for (const heading of [/^Technical Proficiency/, /^Technical Performance/, /^Junior skills/, /^Minimum Requirements/]) {
    assert.ok(!itemsOf(result).some((item) => heading.test(item.text)), `${heading} was scored`);
  }
  // Lists that start with a heading word are still requirements
  itemFor(result, /^Basic NLP, computer vision, or generative AI/);
  itemFor(result, /^Analyzing model performance/);
});

test("Halvik: reworded skills are direct evidence", async () => {
  const result = await halvikResult();
  assert.equal(termIn(itemFor(result, /^Feature engineering/), /feature engineering/i).match, "direct");
  assert.equal(termIn(itemFor(result, /document-heavy/), /document-heavy/i).match, "direct");
  assert.equal(termIn(itemFor(result, /MLOps concepts/), /model lifecycle/i).match, "direct");
  assert.equal(termIn(itemFor(result, /model evaluation and performance optimization/), /performance optimization/i).match, "direct");
});

test("Halvik: OR requirements are satisfied by any one alternative", async () => {
  const result = await halvikResult();
  const tasks = itemFor(result, /^Basic NLP, computer vision, or generative AI/);
  assert.equal(tasks.satisfaction, "Satisfied");
  assert.equal(tasks.score, 1, "missing computer vision isn't penalized");
  const bedrock = itemFor(result, /Amazon Bedrock or similar/);
  assert.equal(bedrock.satisfaction, "Satisfied", "a similar GenAI platform (OCI) counts");
});

test("Halvik: true gaps stay gaps", async () => {
  const result = await halvikResult();
  assert.equal(termIn(itemFor(result, /Python, Javascript, Java/), /^Java$/).match, "missing");
  const federal = itemFor(result, /federal contracting/);
  assert.equal(federal.score, 0);
  const section508 = itemFor(result, /Section 508/);
  assert.equal(section508.score, 0);
  // A modifier ("ML", "AI/ML") doesn't stand in for the achievement; a
  // public profile with a project is public work, not a contribution
  const openSource = itemFor(result, /open-source ML projects/);
  assert.equal(openSource.terms[0].match, "partial");
  assert.ok(openSource.score < 0.5, `${openSource.score}`);
  assert.match(openSource.terms[0].reason, /public work, not an open-source contribution/);
  assert.equal(itemFor(result, /Publications or presentations/).score, 0);
});

test("Halvik: AI coding tools are Unverified, Public Trust needs verification", async () => {
  const result = await halvikResult();
  const tools = itemFor(result, /AI coding harnesses/);
  assert.equal(tools.satisfaction, "Unverified");
  assert.equal(tools.weight, 0, "not counted in the score");
  const publicTrust = result.eligibility.find((item) => /public trust/i.test(item.text));
  assert.equal(publicTrust.status, "Unknown");
  assert.match(publicTrust.detail, /verification/i);
  assert.ok(!itemsOf(result).some((item) => /public trust/i.test(item.text)), "not a scored qualification");
});

test("Halvik: a repeated requirement is scored once", async () => {
  const result = await halvikResult();
  assert.ok(itemFor(result, /large language models and prompt engineering/).duplicate);
  assert.ok(itemFor(result, /^Using AI-enabled dev tools/).duplicate);
  assert.ok(!itemFor(result, /LLM engineering such as/).duplicate);
});

test("a years range from zero is not a minimum", async () => {
  const result = await halvikResult();
  assert.ok(!itemsOf(result).some((item) => item.kind === "years"));
  assert.ok(result.notes.some((note) => /0–4 years/.test(note)));
});

// ---- Generalization checks from a second real job ----

test("broad words and generic alternatives don't earn credit", async () => {
  const resume = resumeOf(WORK("Built an agentic workflow that automates reporting with LLMs."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nResponsibilities\n- Partner with business stakeholders to identify opportunities for AI automation\nPreferred\n- Experience with automation platforms such as Microsoft Power Automate, Zapier, Make, or similar workflow technologies" });
  assert.equal(result.categories.responsibilities.items[0].score, 0, "the word AI alone isn't stakeholder partnering");
  assert.equal(result.categories.preferred.items[0].score, 0, "\"workflow\" isn't an automation platform");
});

test("distinct duties that share only a broad word aren't duplicates", async () => {
  const resume = resumeOf(WORK("Built and deployed an LLM assistant on Kubernetes."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nResponsibilities\n- Design, develop, and deploy AI-powered tools that improve operations\n- Create user-friendly interfaces and dashboards that enable adoption of AI\n- Evaluate emerging AI technologies for the AI roadmap" });
  assert.ok(result.categories.responsibilities.items.every((item) => !item.duplicate));
});

test("\"5+ years\" keeps its number; a years line naming skills keeps the skills", async () => {
  const resume = resumeOf([["Acme Corp", "Engineer Jan 2021 – Dec 2023", "Built AI agents with LangGraph."]]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n5+ years of experience in software engineering\n2+ years of experience building AI agents" });
  const years = result.categories.required.items.find((item) => item.kind === "years");
  assert.equal(years.text, "5+ years of software engineering");
  assert.ok(result.categories.required.items.some((item) => /building AI agents/.test(item.text) && item.score > 0.9));
});

test("spelled-out terms match their acronym; job titles count as occupation evidence", async () => {
  const resume = resumeOf([["PayPal", "Software Engineer Jan 2021 – Dec 2021", "Added PII redaction and RBAC to the LLM services."]]);
  const rbac = await termScore("Knowledge of role-based access controls", /role-based/, [["PayPal", "Software Engineer Jan 2021 – Dec 2021", "Added PII redaction and RBAC to the LLM services."]]);
  assert.equal(rbac.match, "direct");
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience in software engineering or a related discipline" });
  assert.equal(result.categories.required.items[0].terms.find((term) => /software engineering/i.test(term.term)).match, "direct");
});

test("benefits text doesn't set the job's industry", async () => {
  const resume = resumeOf(WORK("Built Python services."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Python\nBenefits\nMedical, dental, and vision insurance\nLife and disability insurance" });
  assert.equal(result.categories.domain.score, null);
});

test("Equivalence agent: a relation the cited bullet doesn't support earns nothing", async () => {
  const resume = resumeOf(WORK("Built a RAG assistant with LangChain over enterprise documents."));
  const llm = { async invokeJson(system, input) {
    if (system.includes("under another name")) return { matches: [{ term: input.terms.find((term) => /zorblax/i.test(term)) || input.terms[0], bullet: 0, technology: "LangChain", relation: "equivalent", relationship: "Both are AI" }] };
    return {};
  } };
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Zorblax vision pipelines", llm });
  const term = result.categories.required.items[0].terms.find((entry) => /zorblax/i.test(entry.term));
  assert.ok(term, "the unfamiliar term was scored");
  assert.equal(term.score, 0, `credited ${term.score} via ${term.via}`);
  assert.ok(term.needsReview);
});

// ---- Contextually inferred experience ----

test("inference: CI/CD work implies basic Git, but not expert Git", async () => {
  const jobs = WORK("Built GitHub Actions CI/CD pipelines that deploy Python services to production.");
  const basic = await termScore("Basic Git / version control", "Git", jobs);
  assert.equal(basic.match, "inferred");
  assert.ok(basic.score >= 0.6 && basic.score < 1, `basic Git: ${basic.score}`);
  assert.equal(basic.confidence, "low");
  const expert = await termScore("Expert Git branching and repository administration", /git/i, jobs);
  assert.equal(expert.score, 0, "inference alone never satisfies expert depth");
  assert.equal(expert.match, "confirm");
});

test("inference: deeper asks get less inferred credit", async () => {
  const jobs = WORK("Built GitHub Actions CI/CD pipelines for Python services.");
  const familiar = await termScore("Familiarity with Git", "Git", jobs);
  const experience = await termScore("Experience with Git", "Git", jobs);
  assert.ok(familiar.score > experience.score, `${familiar.score} vs ${experience.score}`);
});

test("inference: nothing is inferred from a skills list", async () => {
  const resume = resumeOf(WORK("Built Python services."), ["SKILLS", "CI/CD, Docker"]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Basic Git / version control" });
  const git = result.categories.required.items[0].terms.find((term) => term.term === "Git");
  assert.notEqual(git.match, "inferred");
});

test("inference: MLOps needs more than one lifecycle signal", async () => {
  const one = await termScore("Experience with MLOps", "MLOps", WORK("Built CI/CD pipelines for web services."));
  assert.notEqual(one.match, "inferred");
  const several = await termScore("Experience with MLOps", "MLOps", WORK("Deployed XGBoost models behind REST APIs with CI/CD and drift monitoring."));
  assert.equal(several.match, "inferred");
});

test("inference: Agile is plausible, needs confirmation, earns nothing, and isn't a gap", async () => {
  const resume = resumeOf(WORK("Shipped weekly releases with a cross-functional team of 8."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience in Agile environments" });
  const item = result.categories.required.items[0];
  assert.equal(item.score, 0);
  assert.equal(item.satisfaction, "Needs confirmation");
  assert.ok(!result.findings.gaps.some((gap) => /agile/i.test(gap)));
  assert.ok(result.findings.toConfirm.some((entry) => /agile/i.test(entry.term)));
});

test("React and Node.js in work bullets show JavaScript; Python never shows Java", async () => {
  const javascript = await termScore("Experience with JavaScript", "JavaScript", WORK("Built React and Node.js dashboards for 2,000 users."));
  assert.ok(["direct", "equivalent"].includes(javascript.match));
  const java = await termScore("Experience with Java", "Java", WORK("Built Python and Go services for payments."));
  assert.equal(java.match, "missing");
});

test("Docker, Kubernetes and Terraform demonstrate DevOps tooling", async () => {
  const devops = await termScore("Experience with modern DevOps tools", /devops/i, WORK("Deployed services with Docker, Kubernetes and Terraform."));
  assert.ok(devops.score >= 0.9, `${devops.match} ${devops.score}`);
});

test("a comma list with no and/or is read in the light of the whole job, never silently as all", async () => {
  const result = await halvikResult();
  const languages = itemFor(result, /Python, Javascript, Java/);
  // Junior role, Python recurs elsewhere, Java and JavaScript don't: most likely any one
  assert.equal(languages.ambiguity.likely, "any");
  assert.equal(languages.satisfaction, "Likely satisfied");
  assert.deepEqual(languages.probablyNotNeeded, ["Java"]);
  assert.ok(languages.score > languages.ambiguity.asAll && languages.score < languages.ambiguity.asAny, `${languages.score}`);
  assert.match(languages.reason, /most likely means any one/);
  assert.deepEqual(languages.ambiguity.interpretations.map((entry) => entry.reading), ["any one", "all"]);

  // A senior full-stack job where each language recurs: most likely all of them
  const job = "Senior Full-Stack Engineer\nResponsibilities\n- Build services in Python, Java and JavaScript\nRequirements\n- Experience with Python, JavaScript, Java";
  const senior = await compareResume({ resume: resumeOf(WORK("Built Python services and data pipelines for 3 teams.")), jobDescription: job });
  const line = senior.categories.required.items.find((item) => item.ambiguity);
  assert.notEqual(line.ambiguity.likely, "any");
  assert.equal(line.satisfaction, "Not satisfied");
});

// ---- Compound requirements, product names, teamwork, confirmations ----

test("generic CI/CD doesn't prove Azure DevOps; Docker/Kubernetes do prove DevOps tooling", async () => {
  const jobs = WORK("Set up CI/CD with GitHub Actions and deployed services with Docker and Kubernetes.");
  const azure = await termScore("Experience with Azure DevOps", "Azure DevOps", jobs);
  assert.ok(!["direct", "equivalent", "related"].includes(azure.match), `${azure.match} via ${azure.via}`);
  assert.ok(azure.score < 0.5);
  const devops = await termScore("Experience with DevOps tools", /devops tools/i, jobs);
  assert.ok(devops.score >= 0.9);
});

test("a compound requirement is split: missing Agile doesn't erase DevOps credit, and teamwork is its own capability", async () => {
  const resume = resumeOf(WORK("Built CI/CD pipelines with GitHub Actions, Docker and Terraform for 12 services."));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience collaborating in Agile development environments and using modern DevOps tools (e.g., Azure DevOps, GitHub)" });
  const item = result.categories.required.items[0];
  assert.ok(item.score >= 0.3, `evidence score ${item.score}`);
  assert.ok(item.fitScore > item.score, "fit leaves out what needs confirmation");
  assert.ok(item.logic.find((group) => group.terms.some((term) => /DevOps tools/.test(term))).score >= 0.9, "DevOps credit kept");
  assert.ok(item.toConfirm.includes("Team collaboration"), "teamwork not described: to confirm, not a gap");
  assert.ok(!(item.capability?.asks || []).some((word) => /collaborat/.test(word)), "no stem shown as a missing keyword");
  // Nothing here even suggests Agile (no releases, sprints or team work): it's not demonstrated
  assert.ok(item.unmet.includes("Agile development"));
  assert.ok(result.fit >= result.overall);
});

test("teamwork needs people: agents collaborating isn't teamwork; working with product managers is", async () => {
  const job = "Engineer\nResponsibilities\n- Work with clients, key stakeholders, and cross-functional teams";
  const agents = await compareResume({ resume: resumeOf(WORK("Built LangGraph agents that collaborate over A2A to answer questions.")), jobDescription: job });
  assert.equal(agents.categories.responsibilities.items[0].match, "confirm");
  assert.ok(!agents.findings.gaps.length, "unconfirmed teamwork isn't a gap");
  const people = await compareResume({ resume: resumeOf(WORK("Worked closely with product managers and data scientists to ship churn models.")), jobDescription: job });
  assert.equal(people.categories.responsibilities.items[0].score, 1);
});

test("Azure or AWS: equal alternatives are named together in the advice", async () => {
  const { recommendationsFor } = require("../services/match/recommendations");
  const resume = resumeOf(WORK("Built Python services."), ["SKILLS", "AWS, Azure"]);
  const result = await compareResume({ resume, jobDescription: "Engineer\nPreferred\n- Experience with Azure or AWS cloud platforms" });
  const advice = recommendationsFor(result, { checks: [] }).find((item) => /Azure or AWS/.test(item.issue));
  assert.match(advice.recommendation, /Azure and AWS are listed/);
  assert.doesNotMatch(advice.recommendation, /Azure: only listed/);
});

test("never-equivalences hold even when an agent suggests them", async () => {
  const resume = resumeOf(WORK("Wrote prompt engineering guides and built LangChain RAG apps."));
  const llm = { async invokeJson(system, input) {
    if (!system.includes("under another name")) return {};
    return { matches: input.terms.map((term) => ({ term, bullet: 0, technology: /508|accessib/i.test(term) ? "prompt engineering" : "LangChain", relation: "equivalent", relationship: "close" })) };
  } };
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with computer vision\n- Familiarity with Section 508 accessibility", llm });
  for (const item of result.categories.required.items) assert.equal(item.score, 0, `${item.text}: ${item.score}`);
});

test("MLOps: each lifecycle part is checked and reported", async () => {
  // Enough parts shown in real work: MLOps is demonstrated by another name
  const mlops = await termScore("Experience with MLOps", "MLOps", WORK("Trained XGBoost models, deployed them behind REST APIs with CI/CD, tracked them in MLflow and monitored drift."));
  assert.equal(mlops.match, "equivalent");
  assert.ok(mlops.components.shown.includes("model training"));
  assert.ok(mlops.components.notShown.includes("automated retraining"));
  // Two parts: inferred, proportional, never full
  const some = await termScore("Experience with MLOps", "MLOps", WORK("Trained XGBoost models and deployed them to production for 3 teams."));
  assert.equal(some.match, "inferred");
  assert.ok(some.score > 0.2 && some.score <= 0.85, `${some.score}`);
});

test("confirmations: Yes gives self-reported credit below demonstrated; No removes the inference", async () => {
  const resume = resumeOf(WORK("Built GitHub Actions CI/CD pipelines for Python services."));
  const job = "Engineer\nRequirements\n- Basic Git / version control";
  const git = (result) => result.categories.required.items[0].terms.find((term) => term.term === "Git");
  const yes = git(await compareResume({ resume, jobDescription: job, confirmations: { git: "yes" } }));
  const no = git(await compareResume({ resume, jobDescription: job, confirmations: { git: "no" } }));
  assert.equal(yes.match, "confirmed");
  assert.ok(yes.score < 1 && yes.score > 0.5);
  assert.match(yes.reason, /Add it/);
  assert.notEqual(no.match, "inferred");
});

// ---- Contact links behind clickable text ----

test("LinkedIn behind clickable DOCX text is found, and labeled as a link", async () => {
  const zip = new JSZip();
  const run = (text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="w" xmlns:r="r"><w:body>${run("Jane Doe")}<w:p><w:hyperlink r:id="rId9"><w:r><w:t>LinkedIn</w:t></w:r></w:hyperlink><w:r><w:t> | jane@example.com</w:t></w:r></w:p>${run("EXPERIENCE")}${run("Acme Corp")}${run("Engineer Jan 2020 – Present")}${run("• Built Python services.")}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0"?><Relationships><Relationship Id="rId9" Type="hyperlink" Target="https://www.linkedin.com/in/jane-doe-42/" TargetMode="External"/></Relationships>`);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const { text, meta } = await readResume(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.deepEqual(meta.links, [{ url: "https://www.linkedin.com/in/jane-doe-42/", text: "LinkedIn" }]);
  const { contact } = parseResumeText(text, { links: meta.links }).resume;
  assert.equal(contact.linkedin, "https://www.linkedin.com/in/jane-doe-42/");
  assert.equal(contact.linkedinFrom, "link");
});

test("\"LinkedIn: handle\" written as text counts, without inventing one from other words", () => {
  const labeled = parseResumeText("Jane Doe\nLinkedIn: jane-doe-123 | GitHub: janedoe\nEXPERIENCE\nAcme\nEngineer Jan 2020 – Present\n• Built things.").resume.contact;
  assert.equal(labeled.linkedin, "linkedin.com/in/jane-doe-123");
  assert.equal(labeled.linkedinFrom, "label");
  assert.equal(labeled.github, "github.com/janedoe");
  const none = parseResumeText("Jane Doe\njane@example.com\nEXPERIENCE\nAcme\nEngineer Jan 2020 – Present\n• Grew our LinkedIn audience by 40%.").resume.contact;
  assert.equal(none.linkedin, "", "a LinkedIn mention in a bullet isn't a profile");
});

test("the ATS check says when LinkedIn is only behind clickable text", () => {
  const { atsFileCheck } = require("../services/resume/atsFileCheck");
  const parsed = parseResumeText("Jane Doe\nLinkedIn | jane@example.com | 555-123-4567\nEXPERIENCE\nAcme\nEngineer Jan 2020 – Present\n• Built things.", { links: [{ url: "https://linkedin.com/in/jane", text: "LinkedIn" }] });
  const linkedin = atsFileCheck({ text: "x", meta: {}, parsed, type: "application/pdf", keywordScore: 50 }).checks.find((item) => item.id === "linkedin");
  assert.equal(linkedin.status, "pass");
  assert.match(linkedin.detail, /clickable text/);
});

// ---- Job title and company ----

test("job title and company are read from the job description, skipping job-board lines", () => {
  const { jobInfoOf } = require("../services/match/jobInfo");
  assert.deepEqual(jobInfoOf(fixture("halvik-job.txt")), { title: "AI/ML Engineer - Junior", company: "Halvik Corp" });
  assert.deepEqual(jobInfoOf("About the job\nAbout Loenbro\nLoenbro is a trusted partner.\nJob Summary\nThe AI Engineer designs, develops, and deploys AI solutions."), { title: "AI Engineer", company: "Loenbro" });
  assert.deepEqual(jobInfoOf("Job Title: Registered Nurse - Med/Surg\nCompany: Baylor Scott & White\nResponsibilities"), { title: "Registered Nurse - Med/Surg", company: "Baylor Scott & White" });
  assert.deepEqual(jobInfoOf("Senior Data Engineer at Acme Health\nRequirements"), { title: "Senior Data Engineer", company: "Acme Health" });
  // Nothing to find: blanks, not guesses
  assert.deepEqual(jobInfoOf("About us\nWe build tools.\nResponsibilities\n- Write code"), { title: "", company: "" });
});

test("a typed title and company win over what's read from the job", async () => {
  const resume = resumeOf(WORK("Built Python services."));
  const jobDescription = fixture("halvik-job.txt");
  const read = await compareResume({ resume, jobDescription });
  assert.equal(read.header.company, "Halvik Corp");
  assert.equal(read.header.role, "AI/ML Engineer - Junior");
  assert.equal(read.seniority.job, "Junior", "the level in the title is kept");
  const typed = await compareResume({ resume, jobDescription, company: "USPTO (via Halvik)", jobTitle: "Machine Learning Engineer" });
  assert.equal(typed.header.company, "USPTO (via Halvik)");
  assert.equal(typed.header.role, "Machine Learning Engineer");
  assert.equal(typed.header.from.company, "you");
});

// ---- Semantic requirement interpretation & alternative matching ----

const lineFor = async (requirement, bullets, extra = []) => {
  const result = await compareResume({ resume: resumeOf(bullets.map ? [["Acme Corp", "Engineer Jan 2020 – Present", ...bullets]] : WORK(bullets), extra), jobDescription: `Engineer\nRequirements\n- ${requirement}` });
  return result.categories.required.items[0];
};

test("Python or Java with Python shown: satisfied; Python and Java: partial", async () => {
  const bullets = ["Built Python services for billing."];
  const either = await lineFor("Experience with Python or Java", bullets);
  assert.equal(either.satisfaction, "Satisfied");
  assert.equal(either.logic[0].operator, "or");
  const both = await lineFor("Experience with Python and Java", bullets);
  assert.equal(both.satisfaction, "Not satisfied");
  assert.ok(both.score > 0 && both.score < 1);
});

test("Azure or AWS with AWS shown in work: satisfied, and Azure isn't advised", async () => {
  const { recommendationsFor } = require("../services/match/recommendations");
  const result = await compareResume({ resume: resumeOf(WORK("Deployed services on AWS Lambda and S3.")), jobDescription: "Engineer\nRequirements\n- Experience with Azure or AWS cloud platforms" });
  assert.equal(result.categories.required.items[0].satisfaction, "Satisfied");
  assert.ok(!recommendationsFor(result, { checks: [] }).some((item) => /Azure/.test(item.recommendation)));
});

test("DevOps tools such as Azure DevOps or GitHub, with Jenkins shown: tooling satisfied", async () => {
  const item = await lineFor("Experience with modern DevOps tools (e.g., Azure DevOps, GitHub)", ["Built Jenkins pipelines that deploy 12 services."]);
  const tooling = item.logic.find((group) => group.operator.startsWith("examples"));
  assert.ok(tooling.score >= 0.9, JSON.stringify(item.logic));
});

test("Claude Code or similar, with Cursor used in work: satisfied; with only LangGraph: not", async () => {
  const requirement = "Experience using AI-enabled development tools such as Claude Code, GitHub Copilot, or similar technologies";
  const cursor = await lineFor(requirement, ["Used Cursor to refactor and test the payments service, cutting review time 30%."]);
  assert.ok(cursor.score >= 0.9, `${cursor.score}: ${cursor.reason}`);
  assert.notEqual(cursor.satisfaction, "Not satisfied");
  const langgraph = await lineFor(requirement, ["Built LangGraph agents that answer support questions."]);
  assert.equal(langgraph.score, 0);
  assert.notEqual(langgraph.satisfaction, "Satisfied");
});

test("\"or similar\": a strongly related framework counts as doing the same job", async () => {
  const flexible = await lineFor("Experience with PyTorch or similar deep learning frameworks", ["Trained TensorFlow models for image classification."]);
  const strict = await lineFor("Experience with PyTorch", ["Trained TensorFlow models for image classification."]);
  assert.ok(flexible.score > strict.score, `${flexible.score} vs ${strict.score}`);
  assert.ok(flexible.terms.some((term) => term.flexibleMatch));
});

test("stated operators beat punctuation: all of, at least one of, at least two of", async () => {
  const bullets = ["Built Python services for billing."];
  const all = await lineFor("Experience with all of Python, JavaScript, and Java", bullets);
  assert.ok(!all.ambiguity, "\"all of\" isn't ambiguous");
  assert.equal(all.satisfaction, "Not satisfied");
  const anyOne = await lineFor("Experience with at least one of Python, JavaScript, Java", bullets);
  assert.equal(anyOne.satisfaction, "Satisfied");
  const two = await lineFor("Experience with at least two of Python, Go, Java", ["Built Python and Go services for billing."]);
  assert.equal(two.satisfaction, "Satisfied");
  const twoOfOne = await lineFor("Experience with at least two of Python, Go, Java", bullets);
  assert.notEqual(twoOfOne.satisfaction, "Satisfied");
});

test("an ambiguous comma list reports both readings instead of picking one", async () => {
  const item = await lineFor("Experience with Python, JavaScript, Java", ["Built Python services for billing."]);
  assert.equal(item.satisfaction, "Ambiguous");
  assert.equal(item.logic?.[0]?.operator ?? "comma list (unclear)", "comma list (unclear)");
  assert.ok(item.ambiguity.asAny === 1 && item.ambiguity.asAll < 1);
});

// ---- Experience duration & near-match scoring ----

const careerOf = () => resumeOf([
  ["Acme AI", "ML Engineer Jan 2022 – Dec 2025", "Trained XGBoost models for churn prediction."],
  ["Shop Co", "Store Manager Jan 2018 – Dec 2021", "Managed a team of 12 staff."]
]);
const yearsItems = (result) => [...result.categories.required.items, ...result.categories.preferred.items].filter((item) => item.kind === "years");

test("years: the spec example, 4 of 5 relevant AI/ML years is an 80% strong near-match", async () => {
  const [item] = yearsItems(await compareResume({ resume: careerOf(), jobDescription: "ML Engineer\nRequirements\n- 5+ years of relevant AI/ML experience" }));
  assert.deepEqual([item.years.requested, item.years.demonstrated, item.years.shortfall, item.years.coverage], [5, 4, 1, 80]);
  assert.equal(item.classification, "Strong near-match");
  assert.equal(item.status, "Below minimum", "a near-match is labeled, not credited in full");
  assert.equal(item.score, 0.8);
  assert.deepEqual(item.years.excluded, ["Shop Co"], "unrelated work isn't counted");
  assert.match(item.reason, /treats the experience requirement flexibly/);
});

test("years: phrasings, several requirements, and the tolerance setting", async () => {
  const job = "Engineer\nRequirements\n- Minimum 7 years in software\n- At least 3 years of experience overall\nPreferred\n- 2+ years of Kubernetes experience";
  const items = yearsItems(await compareResume({ resume: careerOf(), jobDescription: job }));
  assert.deepEqual(items.map((item) => [item.years.requested, item.years.demonstrated, item.category]), [[7, 4, "required"], [3, 8, "required"], [2, 0, "preferred"]]);
  assert.equal(items[0].classification, "Partial experience", "3 years short is outside the tolerance");
  const lenient = yearsItems(await compareResume({ resume: careerOf(), jobDescription: job, yearsTolerance: 3 }));
  assert.equal(lenient[0].classification, "Strong near-match");
  assert.equal(lenient[0].score, items[0].score, "the tolerance changes the label, not the credit");
});

test("years: a strict minimum stays an eligibility gate however close", async () => {
  const result = await compareResume({ resume: careerOf(), jobDescription: "Engineer\nRequirements\n- 5+ years of AI/ML experience (strict, no exceptions)" });
  const [item] = yearsItems(result);
  assert.equal(item.status, "Strict requirement unmet");
  assert.equal(result.blocked.length, 1);
});

test("years: overlapping jobs and internships are never double-counted", async () => {
  const resume = resumeOf([
    ["Acme AI", "ML Engineer Jan 2022 – Dec 2023", "Trained XGBoost models."],
    ["Beta Labs", "ML Engineer (part-time) Jan 2023 – Dec 2024", "Built PyTorch models."],
    ["Uni Lab", "ML Intern Jan 2020 – Dec 2021", "Trained scikit-learn models."]
  ]);
  const [item] = yearsItems(await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- 4+ years of machine learning experience" }));
  assert.equal(item.years.demonstrated, 3, "2022–2024 counted once; the internship apart");
});

test("years: duration is separate from technical capability", async () => {
  const result = await compareResume({ resume: careerOf(), jobDescription: "Engineer\nRequirements\n- 2+ years of experience building XGBoost models" });
  const items = result.categories.required.items;
  assert.ok(items.some((item) => item.kind === "years" && item.status === "Met"));
  assert.ok(items.some((item) => item.kind !== "years" && /XGBoost/.test(item.text)), "the skill is scored on its own");
});

test("years in a specific skill count only jobs that show it; a vague item doesn't widen the field", async () => {
  const resume = resumeOf([
    ["Oracle", "AI Engineer Aug 2024 – Dec 2025", "Built LangGraph agents with human-in-the-loop review."],
    ["Verizon", "ML Engineer Jan 2020 – Dec 2023", "Trained XGBoost models for churn."]
  ]);
  const [item] = yearsItems(await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- 2+ years of experience building AI agents, agentic workflows, or autonomous AI solutions" }));
  assert.deepEqual(item.years.excluded, ["Verizon"]);
  assert.equal(item.classification, "Strong near-match");
  const [software] = yearsItems(await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- 5+ years in software or data engineering" }));
  assert.equal(software.years.demonstrated, 5.4, "\"software or data engineering\" means both fields");
});

// ---- Contextual Intelligence v2 ----

test("abbreviations: LLM = Large Language Model, RAG = Retrieval-Augmented Generation, both ways", async () => {
  const llm = await termScore("Experience working with large language models", /large language models|llms?/i, WORK("Built LLM services that answer support questions for 2,000 users."));
  assert.equal(llm.match, "direct");
  const rag = await termScore("Experience with retrieval-augmented generation", /retrieval-augmented generation|^rag$/i, WORK("Built a RAG assistant over 10,000 documents for 3 teams."));
  assert.equal(rag.match, "direct");
  const back = await termScore("Experience with RAG", "RAG", WORK("Built a retrieval-augmented generation assistant for 3 teams."));
  assert.equal(back.match, "direct");
  // One requirement, not two: "retrieval-augmented generation (RAG)" is one term
  const result = await compareResume({ resume: resumeOf(WORK("Built a RAG assistant for 3 teams.")), jobDescription: "Engineer\nRequirements\n- Experience with retrieval-augmented generation (RAG)" });
  assert.equal(result.categories.required.items[0].terms.length, 1);
});

test("abbreviations: a context-sensitive short form counts only in its field", async () => {
  const resume = WORK("Updated the CV template and onboarding documents for 40 new hires.");
  const cv = await termScore("Experience with computer vision", /computer vision/i, resume);
  assert.notEqual(cv.match, "direct", "a curriculum vitae isn't computer vision");
  const real = await termScore("Experience with computer vision", /computer vision/i, WORK("Trained CV models for object detection on 2M images with PyTorch."));
  assert.equal(real.match, "direct");
});

test("examples of a general capability: Jenkins qualifies for DevOps tools (e.g., Azure DevOps, GitHub)", async () => {
  const result = await compareResume({
    resume: resumeOf(WORK("Built Jenkins pipelines that test and release 12 services.")),
    jobDescription: "Engineer\nRequirements\n- Experience using modern DevOps tools (e.g., Azure DevOps, GitHub)."
  });
  const item = result.categories.required.items[0];
  assert.ok(item.score >= 0.9, `${item.score}`);
  assert.ok(!item.unmet.some((name) => /Azure DevOps/.test(name)), "a named example isn't required");
});

test("\"Claude Code or similar\": Cursor qualifies when its use is documented", async () => {
  const result = await compareResume({
    resume: resumeOf(WORK("Built and tested 4 internal services with Cursor and AI-assisted coding, cutting review time 30%.")),
    jobDescription: "Engineer\nRequirements\n- Experience using AI-enabled development tools such as Claude Code, GitHub Copilot, or similar technologies"
  });
  const item = result.categories.required.items[0];
  assert.ok(!item.unverified);
  assert.ok(item.score >= 0.9, `${item.score} ${item.reason}`);
});

test("Python AND Java: Python alone doesn't satisfy", async () => {
  const result = await compareResume({ resume: resumeOf(WORK("Built Python services for 3 teams.")), jobDescription: "Engineer\nRequirements\n- Experience with Python and Java" });
  const item = result.categories.required.items[0];
  assert.equal(item.satisfaction, "Not satisfied");
  assert.ok(item.score <= 0.5, `${item.score}`);
});

test("basic Git from CI/CD is inferred, not verified; listed too, it's supported but still below verified", async () => {
  const inferred = await termScore("Basic Git / version control", "Git", WORK("Built GitHub Actions CI/CD pipelines that deploy Python services for 3 teams."));
  assert.equal(inferred.match, "inferred");
  assert.ok(inferred.score < 0.95);
  const both = await termScore("Basic Git / version control", "Git", WORK("Built GitHub Actions CI/CD pipelines that deploy Python services for 3 teams."), ["SKILLS", "Python, Git"]);
  assert.equal(both.match, "inferred");
  assert.ok(both.score > inferred.score && both.score <= 0.9, `${both.score}`);
  // "version control" is the same ask, not extra context
  const result = await compareResume({ resume: resumeOf(WORK("Built GitHub Actions CI/CD pipelines for 3 teams.")), jobDescription: "Engineer\nRequirements\n- Basic Git / version control" });
  assert.ok(!result.categories.required.items[0].capability, "no leftover 'version control' context");
});

test("AI APIs: building or integrating AI endpoints qualifies; using a chatbot doesn't", async () => {
  const served = await termScore("Working with AI APIs", "AI APIs", WORK("Deployed LLM services as FastAPI microservices on Kubernetes for 2,000 users."));
  assert.equal(served.match, "direct");
  const integrated = await termScore("Working with AI APIs", "AI APIs", WORK("Integrated the OpenAI API into the support portal to draft replies for 40 agents."));
  assert.equal(integrated.match, "direct");
  const used = await termScore("Working with AI APIs", "AI APIs", WORK("Used ChatGPT to draft weekly status emails for the team."));
  assert.notEqual(used.match, "direct");
});

test("open-source contribution: a private project doesn't qualify; publications OR presentations: one is enough", async () => {
  const job = "Engineer\nPreferred\n- Contributions to open-source ML projects\n- Publications or presentations in AI/ML";
  const lines = ["Jane Doe", "Engineer", "jane@example.com", "EXPERIENCE", "Acme Corp", "Engineer Jan 2020 – Present", "• Built Python services for 3 teams.",
    "PROJECTS", "Churn Model | Python", "• Built a churn model in Python with scikit-learn, evaluated on 50,000 records and deployed as a REST API."];
  lines.splice(3, 0, "SUMMARY", "Engineer who presented at PyCon 2024 on evaluating RAG systems.");
  const { resume } = parseResumeText(lines.join("\n"));
  const result = await compareResume({ resume, jobDescription: job });
  const [openSource, talks] = result.categories.preferred.items;
  assert.equal(openSource.score, 0, "no public code profile: a private project isn't open source");
  assert.equal(talks.satisfaction, "Satisfied", "a presentation alone satisfies publications or presentations");
});

test("all alternatives missing: one deduction, on that requirement's share only", async () => {
  const job = "Engineer\nRequirements\n- Experience with Python\n- Experience with Rust, Go, or Elixir";
  const result = await compareResume({ resume: resumeOf(WORK("Built Python services for 3 teams.")), jobDescription: job });
  const [python, alternatives] = result.categories.required.items;
  assert.equal(alternatives.score, 0);
  assert.equal(result.categories.required.score, 50, "half the category, not less");
  assert.equal(Math.round((python.points + alternatives.pointsLost) * 10) / 10, Math.round(result.categories.required.weight * 1000) / 10);
});

test("preferred qualifications are advantages: most shown earns the full category, none shown earns none", async () => {
  const job = "Engineer\nRequirements\n- Experience with Python\nPreferred\n- Experience with Docker\n- Experience with Kubernetes\n- Experience with Terraform\n- Experience with Rust\n- Experience with Elixir";
  const resume = resumeOf(WORK("Built Python services in Docker on Kubernetes, provisioned with Terraform, for 3 teams."));
  const most = await compareResume({ resume, jobDescription: job });
  assert.equal(most.categories.preferred.score, 100, "3 of 5 shown");
  assert.ok(most.categories.preferred.items.every((item) => !item.pointsLost), "nothing lost past the expected share");
  const none = await compareResume({ resume: resumeOf(WORK("Built Python services for 3 teams.")), jobDescription: job });
  assert.equal(none.categories.preferred.score, 0);
});

test("AI coding tools: the candidate can confirm them (self-reported, never lowering the score) or say no (a counted gap)", async () => {
  const resume = resumeOf(WORK("Built Python services for 3 teams."));
  const job = "Engineer\nRequirements\n- Experience with Python\n- Experience with AI coding harnesses or related methods for agentic software development";
  const open = await compareResume({ resume, jobDescription: job });
  const question = open.findings.confirmable.find((entry) => entry.key === "ai coding tools");
  assert.ok(question && question.impact > 0, "asked, with what it could change");
  const yes = await compareResume({ resume, jobDescription: job, confirmations: { "ai coding tools": "yes" } });
  const confirmed = yes.categories.required.items[1];
  assert.equal(confirmed.match, "confirmed");
  assert.equal(confirmed.satisfaction, "Confirmed by you");
  assert.match(confirmed.reason, /self-reported/);
  assert.equal(yes.overall, open.overall, "confirming an unscored item doesn't lower the score");
  const no = await compareResume({ resume, jobDescription: job, confirmations: { "ai coding tools": "no" } });
  assert.equal(no.categories.required.items[1].score, 0);
  assert.ok(no.categories.required.items[1].weight > 0, "a No is counted");
  assert.ok(open.overall > no.overall);
});

test("confirmed teamwork is self-reported evidence, labeled and counted (not wiped as unsupported)", async () => {
  const resume = resumeOf(WORK("Built Python services for 3 teams."));
  const job = "Engineer\nResponsibilities\n- Work with clients, key stakeholders, as well as cross-functional teams.";
  const result = await compareResume({ resume, jobDescription: job, confirmations: { "team collaboration": "yes" } });
  const duty = result.categories.responsibilities.items[0];
  assert.equal(duty.match, "confirmed");
  assert.ok(duty.score > 0 && duty.points > 0);
  assert.ok(result.quality.find((check) => /resume evidence/.test(check.check)).passed);
});

test("recommendations keep genuine gaps, missing documentation and confirmed-but-unwritten apart", async () => {
  const { recommendationsFor } = require("../services/match/recommendations");
  const resume = resumeOf(WORK("Built GitHub Actions CI/CD pipelines that deploy Python services for 3 teams."));
  const job = "Engineer\nRequirements\n- Basic Git / version control\n- Experience with Rust\n- Experience in Agile environments";
  const match = await compareResume({ resume, jobDescription: job, confirmations: { agile: "yes" } });
  const recommendations = recommendationsFor(match, { checks: [] });
  const typeFor = (pattern) => recommendations.find((entry) => pattern.test(entry.issue))?.type;
  assert.equal(typeFor(/Rust/), "gap");
  assert.equal(typeFor(/Git/), "documentation");
  assert.equal(typeFor(/Agile/), "confirmed");
});

// ---- Reliability: importance, provenance, consistency, stability ----

const required = (result) => result.categories.required.items;
const preferredItems = (result) => result.categories.preferred.items;

test("importance: \"Python is required. Java and JavaScript are a plus.\" — missing Java/JS don't touch Python's coverage", async () => {
  const result = await compareResume({ resume: resumeOf(WORK("Built Python services for 3 teams.")), jobDescription: "Engineer\nRequirements\n- Experience with Python is required. Java and JavaScript are a plus." });
  assert.equal(required(result).length, 1);
  assert.equal(required(result)[0].score, 1);
  assert.equal(required(result)[0].importance, "mandatory");
  assert.equal(result.categories.required.score, 100);
  assert.match(preferredItems(result)[0].text, /Java and JavaScript are a plus/);
  assert.equal(preferredItems(result)[0].importance, "preferred");
});

test("negation: \"preferred but not required\" is a preference and never a gate; \"not required\" isn't scored", async () => {
  const job = "Engineer\nRequirements\n- Python preferred but not required\n- No prior experience required.\n- Experience with Kafka is not required\n- AWS certification preferred but not mandatory\n- Experience with SQL";
  const result = await compareResume({ resume: resumeOf(WORK("Built SQL reports for 3 teams.")), jobDescription: job });
  assert.deepEqual(required(result).map((item) => item.text), ["Experience with SQL"]);
  const python = preferredItems(result).find((item) => /Python/.test(item.text));
  assert.ok(python);
  assert.notEqual(python.wording, "mandatory");
  assert.ok(!result.eligibility.some((item) => /certification/i.test(item.text)), "a preferred certification isn't a gate");
  assert.ok(result.structure.excluded.some((text) => /Kafka/.test(text)));
  assert.ok(result.structure.excluded.some((text) => /No prior experience/.test(text)));
  assert.ok(!itemsOf(result).some((item) => item.kind === "years"), "\"no prior experience\" isn't a years requirement");
});

test("clauses of different importance in one line are split: \"Must have: Python; nice to have: Go\"", async () => {
  const result = await compareResume({ resume: resumeOf(WORK("Built Python services for 3 teams.")), jobDescription: "Engineer\nRequirements\nMust have: Python; nice to have: Docker\n- Experience with SQL is required, but Rust is a plus" });
  assert.deepEqual(required(result).map((item) => item.text), ["Python", "Experience with SQL is required"]);
  assert.deepEqual(preferredItems(result).map((item) => item.text), ["nice to have: Docker", "Rust is a plus"]);
});

test("a capability repeated across sections is scored once, at its highest importance", async () => {
  const job = "Engineer\nResponsibilities\n- Build data services with Python\nRequirements\n- Experience with Python\nPreferred\n- Experience with Python";
  const result = await compareResume({ resume: resumeOf(WORK("Built Python data services for 3 teams.")), jobDescription: job });
  const counted = itemsOf(result).filter((item) => /Python/.test(item.text) && !item.duplicate);
  assert.equal(counted.length, 2, "the requirement and the duty (a different ask)");
  assert.ok(preferredItems(result)[0].duplicate, "the preferred repeat isn't counted again");
  assert.equal(preferredItems(result)[0].pointsLost, 0);
});

test("provenance: every piece of evidence is exact resume text with its section", async () => {
  const result = await halvikResult();
  const resumeText = fixture("halvik-resume.txt").replace(/\s+/g, " ");
  const entries = itemsOf(result).flatMap((item) => [...(item.evidence || []), ...(item.terms || []).flatMap((term) => term.evidence), ...(item.capabilities || []).flatMap((capability) => capability.evidence)]);
  assert.ok(entries.length > 20);
  for (const entry of entries.filter((each) => each.where !== "Job dates")) {
    // A profile link is read from the contact line ("GitHub: candidate" -> github.com/candidate)
    const shown = entry.section === "Contact line" ? resumeText.includes(entry.text.split("/").pop()) : resumeText.includes(entry.text.replace(/\s+/g, " "));
    assert.ok(shown, `not on the resume: ${entry.text.slice(0, 80)}`);
    assert.ok(entry.section, `no section for ${entry.text.slice(0, 60)}`);
  }
  for (const check of result.quality) assert.ok(check.passed, `${check.check}: ${check.detail}`);
});

test("explanations come from the scoring record and agree with the numbers", async () => {
  for (const result of [await halvikResult(), await compareResume({ resume: resumeOf(WORK("Built Python services for 3 teams.")), jobDescription: "Engineer\nRequirements\n- Experience with Python and Java\n- Basic Git\nPreferred\n- Experience with Rust" })]) {
    for (const item of itemsOf(result).filter((entry) => entry.weight > 0)) {
      assert.ok(item.record, item.text);
      const possible = Math.round((item.points + item.pointsLost) * 10) / 10;
      assert.ok(item.explanation.includes(`Credited ${Math.round(item.score * 100)}%: ${item.points} of ${possible} pts.`), `${item.text}: ${item.explanation}`);
      assert.ok(item.points >= 0 && item.pointsLost >= 0);
      assert.ok(!/[−-]\d/.test(item.explanation), `no negative points: ${item.explanation}`);
      if (item.score > 0) assert.notEqual(item.record.verification, "not shown", item.text);
      if (item.pointsLost) assert.match(item.explanation, /Why: /, `${item.text}: a deduction must be explained`);
    }
    assert.ok(result.quality.find((check) => /agree/.test(check.check)).passed);
  }
});

test("project evidence is credited at its actual scope, never treated as employment", async () => {
  const project = (title, bullet) => ["PROJECTS", title, `• ${bullet}`];
  const job = "Engineer\nRequirements\n- Experience developing AI-powered applications with LangGraph";
  const independent = await compareResume({ resume: resumeOf(WORK("Maintained payroll reports for 40 staff."), project("Research Agent | Python, LangGraph", "Built an agentic AI research assistant in Python with LangGraph, RAG over 5,000 papers and a FastAPI backend, deployed with CI/CD.")), jobDescription: job });
  const term = required(independent)[0].terms.find((entry) => entry.term === "LangGraph");
  assert.equal(term.match, "direct");
  assert.equal(term.source, "Independent project");
  assert.equal(term.score, 1, "a deployed project shows hands-on implementation in full");
  const tutorial = await compareResume({ resume: resumeOf(WORK("Maintained payroll reports for 40 staff."), project("Udemy Agents | LangGraph", "Followed along a Udemy tutorial to build a LangGraph chatbot with a vector store and a small web interface for practice.")), jobDescription: job });
  const learned = required(tutorial)[0].terms.find((entry) => entry.term === "LangGraph");
  assert.equal(learned.source, "Tutorial or course exercise");
  assert.ok(learned.score < term.score);
  assert.equal(learned.proficiency.shown, "learning (tutorial)");
});

test("recency: evidence only from long ago counts a little less, and says when", async () => {
  const old = await termScore("Experience with Kubernetes", "Kubernetes", [["Acme Corp", "Engineer Jan 2010 – Dec 2014", "Ran Kubernetes clusters for 30 services in production."]]);
  assert.equal(old.recency.stale, true);
  assert.equal(old.score, 0.9);
  assert.match(old.note, /Last shown in 2014/);
  const recent = await termScore("Experience with Kubernetes", "Kubernetes", WORK("Ran Kubernetes clusters for 30 services in production."));
  assert.equal(recent.score, 1);
});

test("contradictions: backwards dates, years claims, overlapping full-time jobs and unsupported expertise are reported, not scored", async () => {
  const lines = ["Jane Doe", "Engineer", "jane@example.com", "SUMMARY", "Engineer with 10 years of experience and expert in Rust.", "EXPERIENCE",
    "Acme Corp", "Engineer Jan 2020 – Present", "• Built Python services for 3 teams.",
    "Beta Inc", "Engineer Jan 2021 – Dec 2022", "• Built SQL reports for 2 teams.",
    "Gamma LLC", "Analyst Jun 2019 – Jan 2019", "• Wrote reports."];
  const { resume } = parseResumeText(lines.join("\n"));
  const result = await compareResume({ resume, jobDescription: "Engineer\nRequirements\n- Experience with Python" });
  const kinds = result.findings.contradictions.map((entry) => entry.kind);
  for (const kind of ["dates", "years", "overlap", "claim"]) assert.ok(kinds.includes(kind), `${kind}: ${JSON.stringify(result.findings.contradictions)}`);
  assert.equal(required(result)[0].score, 1, "contradictions don't change the score");
});

test("stability: the same resume and job give identical results every run", async () => {
  const run = async () => JSON.stringify(await compareResume({ resume: parseResumeText(fixture("halvik-resume.txt")).resume, jobDescription: fixture("halvik-job.txt") }));
  const first = await run();
  for (let index = 0; index < 4; index += 1) assert.equal(await run(), first);
});

test("adversarial job text: capitals, emoji bullets, inline headings and boilerplate", async () => {
  const job = ["ENGINEER", "REQUIREMENTS:", "✅ Experience with SQL", "→ Experience with Python is a MUST", "Benefits", "- Experience with free snacks and Python yoga", "Preferred Qualifications:", "* Nice to have: Rust"].join("\n");
  const result = await compareResume({ resume: resumeOf(WORK("Built Python and SQL services for 3 teams.")), jobDescription: job });
  assert.deepEqual(required(result).map((item) => item.text).sort(), ["→ Experience with Python is a MUST", "✅ Experience with SQL"].sort());
  assert.ok(preferredItems(result).some((item) => /Rust/.test(item.text)));
  assert.ok(!itemsOf(result).some((item) => /snacks/.test(item.text)), "benefits aren't requirements");
});

test("ATS formatting (a missing LinkedIn URL) doesn't change the job-fit score", async () => {
  const job = "Engineer\nRequirements\n- Experience with Python";
  const withLink = parseResumeText(["Jane Doe", "Engineer", "jane@example.com | linkedin.com/in/jane", "EXPERIENCE", "Acme Corp", "Engineer Jan 2020 – Present", "• Built Python services for 3 teams."].join("\n")).resume;
  const without = parseResumeText(["Jane Doe", "Engineer", "jane@example.com", "EXPERIENCE", "Acme Corp", "Engineer Jan 2020 – Present", "• Built Python services for 3 teams."].join("\n")).resume;
  const [a, b] = [await compareResume({ resume: withLink, jobDescription: job }), await compareResume({ resume: without, jobDescription: job })];
  assert.equal(a.overall, b.overall);
  assert.equal(a.fit, b.fit);
});

test("the Evidence agent proposes; code decides the strength (a claimed \"strong\" on a weak bullet is partial)", async () => {
  const resume = resumeOf(WORK("Built Python REST APIs with FastAPI for payment services."));
  const jd = "Engineer\nResponsibilities\n- Implement secure token-based authentication and session management for payment services across merchant platforms";
  const llm = { async invokeJson(system) {
    if (system.includes("against a job's responsibilities")) return { matches: [{ responsibility: 0, bullet: 0, level: "strong", capability: "Payment API work", relationship: "Builds payment APIs", technologies: ["FastAPI"], unsupported: [] }] };
    return {};
  } };
  const result = await compareResume({ resume, jobDescription: jd, llm });
  const item = result.categories.responsibilities.items[0];
  assert.ok(item.byAgent);
  assert.equal(item.match, "partial", "the bullet shows little of the duty's wording");
});

test("AWS is a cloud platform: its own services in a bullet show AWS; \"beyond just Bedrock\" leaves Bedrock out", async () => {
  const job = "Engineer\nPreferred\n- Experience with Azure or AWS cloud platforms (beyond just Bedrock)";
  const services = await compareResume({ resume: resumeOf(WORK("Trained models on SageMaker and served them with Lambda for 3 teams.")), jobDescription: job });
  const aws = preferredItems(services)[0].terms.find((term) => term.term === "AWS");
  assert.equal(aws.match, "equivalent");
  assert.equal(preferredItems(services)[0].satisfaction, "Satisfied");
  const bedrock = await compareResume({ resume: resumeOf(WORK("Built a chatbot on AWS Bedrock for 3 teams.")), jobDescription: job });
  assert.ok(preferredItems(bedrock)[0].score < 0.95, "Bedrock alone isn't AWS beyond Bedrock");
});

test("tied alternatives are both covered (Azure and AWS, both listed), and points never go below 0", async () => {
  const result = await halvikResult();
  const clouds = itemFor(result, /Azure or AWS/);
  assert.deepEqual(clouds.covered.sort(), ["AWS", "Azure"]);
  assert.ok(clouds.terms.every((term) => !term.alternative));
  for (const item of itemsOf(result)) assert.ok(item.points >= 0, item.text);
});

test("\"at least one language (Python is a plus) and ... tools like Git and GitHub\": two asks, any language counts, any one tool counts", async () => {
  const job = "Engineer\nRequirements\n- You've written code in at least one language (Python is a plus) and you're comfortable with everyday developer tools like Git and GitHub.";
  const halvik = await compareResume({ resume: parseResumeText(fixture("halvik-resume.txt")).resume, jobDescription: job });
  const item = required(halvik)[0];
  assert.ok(item, "the aside \"(Python is a plus)\" doesn't make the whole line a preference");
  assert.equal(item.satisfaction, "Satisfied");
  assert.deepEqual(item.unmet, [], "\"written\", \"code\", \"comfortable\", \"everyday\" aren't extra asks");
  assert.deepEqual(item.logic.map((group) => group.terms.join("/")), ["Git/GitHub", "Python"], "Python isn't an example of developer tools");
  // Java instead of Python: the language ask is still met
  const java = await compareResume({ resume: resumeOf(WORK("Built Java services and reviewed GitHub pull requests for 3 teams.")), jobDescription: job });
  assert.equal(required(java)[0].terms.find((term) => term.term === "Python").via, "Java");
  assert.equal(required(java)[0].satisfaction, "Satisfied");
});

test("a spaced slash reads as or: \"Azure / AWS\" needs one", async () => {
  const result = await compareResume({ resume: resumeOf(WORK("Ran services on AWS EC2 for 3 teams.")), jobDescription: "Engineer\nRequirements\n- Experience with Azure / AWS" });
  const item = required(result)[0];
  assert.equal(item.logic[0].mode, "any");
  assert.equal(item.satisfaction, "Satisfied");
});
