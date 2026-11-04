// JobPilot from the command line, for validating real resumes and jobs:
//
//   node scripts/matchTrace.js <resume.pdf|.docx|.rtf|.txt> <job.txt> [--ai] [--out trace.json]
//
// Writes the same full trace as "Download full trace (JSON)" in the browser
// and prints a short summary. --ai uses the configured Ollama model.

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { readResume, parseResumeText, DOCX } = require("../services/resume/resumeParser");
const { compareResume } = require("../services/match/resumeCompare");
const { atsFileCheck } = require("../services/resume/atsFileCheck");
const { recommendationsFor } = require("../services/match/recommendations");
const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");

const TYPES = { ".pdf": "application/pdf", ".docx": DOCX, ".rtf": "application/rtf", ".txt": "text/plain", ".md": "text/plain" };

async function main() {
  const args = process.argv.slice(2);
  const [resumePath, jobPath] = args.filter((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--out");
  const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
  if (!resumePath || !jobPath) {
    console.error("Usage: node scripts/matchTrace.js <resume> <job.txt> [--ai] [--out trace.json]");
    process.exit(1);
  }
  const type = TYPES[path.extname(resumePath).toLowerCase()];
  if (!type) throw new Error("The resume must be PDF, DOCX, RTF or TXT");

  const { text, meta } = await readResume(fs.readFileSync(resumePath), type);
  const parsed = parseResumeText(text, { links: meta.links || [] });
  let llm = null;
  if (args.includes("--ai")) {
    const status = await ollamaStatus();
    if (!status.available) throw new Error(status.message);
    llm = createOllamaLlm();
  }

  const match = await compareResume({ resume: parsed.resume, jobDescription: fs.readFileSync(jobPath, "utf8"), llm, onProgress: (message) => console.error(`… ${message}`) });
  const ats = atsFileCheck({ text, meta, parsed, type, keywordScore: match.keywords.score });
  const trace = { file: path.basename(resumePath), aiUsed: Boolean(llm), resume: parsed.resume, found: parsed.found, match, ats, recommendations: recommendationsFor(match, ats) };

  const target = out || `match-trace-${path.basename(resumePath, path.extname(resumePath))}.json`;
  fs.writeFileSync(target, JSON.stringify(trace, null, 2));

  console.log(`${match.overall}% ${match.classification} | ${match.recommendation} | ATS ${ats.score}`);
  console.log("Jobs read:", parsed.resume.experience.map((job) => `${job.organization} / ${job.title} / ${job.dates || "no dates"} / ${job.bullets.length} bullets`).join("\n           "));
  for (const category of Object.values(match.categories)) {
    console.log(`${category.label}: ${category.score === null ? "n/a" : `${Math.round(category.score)}%`} x ${Math.round(category.weight * 100)}%`);
  }
  if (match.findings.parsingIssues.length) console.log("Parsing issues:", match.findings.parsingIssues.join(" | "));
  console.log(`Trace written to ${target}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
