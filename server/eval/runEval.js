// The agents' evaluation: real chat messages, each with what the agent must
// do (eval/cases.js), played through the real agents on an in-memory
// portfolio (eval/memoryTools.js). It scores outcomes, not wording, so a
// prompt or rule change is measured instead of guessed.
//
//   npm run eval                  the rules and trained models only
//   npm run eval -- --llm         with Ollama (OLLAMA_BASE_URL, OLLAMA_MODEL)
//   npm run eval -- --verbose     every case, not only the failures
//   npm run eval -- --update      saves the rules-only score as the baseline
//
// The test suite (tests/eval.test.js) runs the rules-only evaluation and fails
// if fewer cases pass than eval/baseline.json records.
process.env.OLLAMA_EMBED_MODEL ||= "off";
process.env.A2A_DESIGNER_URL ||= "off";

const fs = require("node:fs");
const path = require("node:path");
const cases = require("./cases");
const { memoryTools } = require("./memoryTools");
const { runSupervisor } = require("../services/agents/supervisor");
const { runResumeCustomizer } = require("../services/agents/resumeCustomizer");
const { effectiveResumeSettings } = require("../services/agents/resumeSettingsRules");
const { base } = require("../services/agents/ml/intentEnsemble");

const BASELINE = path.join(__dirname, "baseline.json");
const DESIGN = "navy";

// expected is a pattern over actual: a RegExp matches its text, an array
// needs each of its items somewhere in actual, an object each of its keys
function matches(actual, expected) {
  if (expected instanceof RegExp) return actual !== undefined && actual !== null && expected.test(typeof actual === "string" ? actual : JSON.stringify(actual));
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every((item) => actual.some((value) => matches(value, item)));
  if (expected && typeof expected === "object") return Boolean(actual) && typeof actual === "object" && Object.entries(expected).every(([key, value]) => matches(actual[key], value));
  return actual === expected;
}

// Entry keys ("projects:<id>", "education:<id>:grade") as their labels
function labelled(state, keys = []) {
  // A project inside a job or school is a project on the resume
  const label = new Map(state.entries.flatMap((entry) => [[`${entry.section}:${entry.id}`, entry.label], ...(entry.section.endsWith("_project") ? [[`projects:${entry.id}`, entry.label]] : [])]));
  return keys.map((key) => {
    const [section, id, field] = key.split(":");
    const name = label.get(`${section}:${id}`) || key;
    return field ? `${name}:${field}` : name;
  });
}

// What went wrong with one case's outcome, or [] when it did what was asked
function problemsWith(expect, { state, reply, agent, pending, choices }) {
  const problems = [];
  const check = (name, ok, detail) => ok || problems.push(`${name}: ${detail}`);
  const settings = effectiveResumeSettings(state.settings, DESIGN);
  const changedAnything = state.changes.length > 0;

  if (expect.agent) check("agent", agent === expect.agent, `went to ${agent}`);
  if (expect.nothing) check("nothing", !changedAnything, `changed ${JSON.stringify(state.changes).slice(0, 200)}`);
  if (expect.asks) check("asks", !changedAnything && (/\?/.test(reply) || choices.length > 0), `didn't ask: ${reply.slice(0, 120)}`);
  if (expect.reply) check("reply", expect.reply.test(reply), reply.slice(0, 160));
  if (expect.mentions) check("mentions", expect.mentions.every((name) => reply.toLowerCase().includes(name.toLowerCase())), reply.slice(0, 160));
  if (expect.hidden) check("hidden", matches(labelled(state, settings.hiddenEntries), expect.hidden), `hidden ${JSON.stringify(labelled(state, settings.hiddenEntries))}`);
  if (expect.notHidden) check("notHidden", !labelled(state, settings.hiddenEntries).some((name) => expect.notHidden.includes(name)), `hidden ${JSON.stringify(labelled(state, settings.hiddenEntries))}`);
  if (expect.hiddenFields) check("hiddenFields", matches(labelled(state, settings.hiddenFields), expect.hiddenFields), `hidden fields ${JSON.stringify(labelled(state, settings.hiddenFields))}`);
  if (expect.settings) check("settings", matches(settings, expect.settings), `settings ${JSON.stringify(settings).slice(0, 300)}`);
  if (expect.shared) check("shared", matches(state.settings, expect.shared), `shared ${JSON.stringify({ ...state.settings, designs: undefined }).slice(0, 300)}`);
  for (const [audience, flags] of Object.entries({ resume: expect.resume, portfolio: expect.portfolio })) {
    if (!flags) continue;
    const key = audience === "resume" ? "showInResume" : "showInPortfolio";
    for (const [name, value] of Object.entries(flags)) {
      const entry = state.entries.find((item) => item.label === name);
      check(audience, entry?.[key] === value, `${name} ${key} is ${entry?.[key]}`);
    }
  }
  if (expect.draft) check("draft", state.drafts.some((draft) => matches(draft, expect.draft)), `drafts ${JSON.stringify(state.drafts.map(({ section, data }) => ({ section, data }))).slice(0, 300)}`);
  if (expect.pending) check("pending", matches(pending, expect.pending), `pending ${JSON.stringify(pending)}`);
  if (expect.design) check("design", state.designs.some((design) => matches(design, expect.design)), `designs ${JSON.stringify(state.designs).slice(0, 300)}`);
  return problems;
}

// Plays one case: { chat: "assistant" | "resume", say: "..." or [...turns], expect }
async function runCase(item, { llm = null } = {}) {
  const { tools, state } = memoryTools();
  const turns = Array.isArray(item.say) ? item.say : [item.say];
  let outcome = { reply: "", agent: "", pending: null, choices: [] };

  for (const [index, text] of turns.entries()) {
    // Only the last message's changes are scored; earlier turns set it up
    if (index === turns.length - 1 && turns.length > 1 && item.scoreLastOnly) state.changes = [];
    if (item.chat === "resume") {
      const result = await runResumeCustomizer({ text, designId: DESIGN, layout: item.layout || "left", sideWidth: 30, llm, tools });
      outcome = { reply: result.reply || "", agent: "resume", pending: null, choices: [] };
    } else {
      const result = await runSupervisor({ text, mode: "auto", pending: outcome.pending, context: { path: item.path || "/dashboard" }, llm, tools, intentModel: base });
      outcome = { reply: result.reply || "", agent: result.agent, pending: result.pending || null, choices: result.choices || [] };
    }
  }
  const problems = problemsWith(item.expect, { state, ...outcome });
  return { ...item, pass: problems.length === 0, problems, reply: outcome.reply, agent: outcome.agent };
}

async function runEval({ llm = null, only = null } = {}) {
  const results = [];
  for (const item of cases) {
    if (only && !only.test(item.say.toString())) continue;
    try {
      results.push(await runCase(item, { llm }));
    } catch (error) {
      results.push({ ...item, pass: false, problems: [`error: ${error.message}`], reply: "", agent: "" });
    }
  }
  const byGroup = {};
  for (const result of results) {
    const group = (byGroup[result.group] ||= { pass: 0, total: 0 });
    group.total += 1;
    group.pass += result.pass ? 1 : 0;
  }
  return { results, passed: results.filter((result) => result.pass).length, total: results.length, byGroup };
}

const readBaseline = () => {
  try {
    return JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  } catch {
    return null;
  }
};

async function main() {
  const args = process.argv.slice(2);
  let llm = null;
  if (args.includes("--llm")) {
    const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
    const status = await ollamaStatus();
    if (!status.available) {
      console.error(`No language model: ${status.message}`);
      process.exit(1);
    }
    llm = createOllamaLlm();
  }
  const { results, passed, total, byGroup } = await runEval({ llm });
  for (const result of results) {
    if (result.pass && !args.includes("--verbose")) continue;
    console.log(`${result.pass ? "PASS" : "FAIL"} [${result.group}] ${JSON.stringify(result.say)}`);
    for (const problem of result.problems) console.log(`     ${problem}`);
    if (!result.pass) console.log(`     reply: ${result.reply.replace(/\s+/g, " ").slice(0, 160)}`);
  }
  console.log("\nBy group:");
  for (const [group, { pass, total: count }] of Object.entries(byGroup)) console.log(`  ${group.padEnd(14)} ${pass}/${count}`);
  const baseline = readBaseline();
  console.log(`\n${llm ? `With ${llm.model}` : "Rules and trained models"}: ${passed}/${total} (${Math.round((passed / total) * 100)}%)${baseline ? `, baseline ${baseline.passed}/${baseline.total}` : ""}`);
  if (args.includes("--update")) {
    if (llm) throw new Error("The baseline is the rules-only score; run --update without --llm");
    fs.writeFileSync(BASELINE, `${JSON.stringify({ passed, total, failing: results.filter((result) => !result.pass).map((result) => result.say) }, null, 2)}\n`);
    console.log("Saved as the baseline.");
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { runEval, runCase, readBaseline, matches };
