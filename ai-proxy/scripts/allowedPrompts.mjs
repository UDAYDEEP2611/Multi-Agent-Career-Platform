// Writes src/allowedPrompts.json: the SHA-256 of every system prompt the demo's
// agents send. The proxy runs only those prompts, so it can't be used as a
// general-purpose free model. Run again whenever a prompt changes (deploy does).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../server/package.json", import.meta.url));
// The demo's chat agents, and CV Maker (resume agent and job match)
const MODULES = [
  "agents/supervisor", "agents/dataEntryAgent", "agents/qaAgent", "agents/designPlanner", "agents/resumeCustomizer",
  "resume/resumeAgent", "resume/keywordWeaver", "resume/summaryFit", "match/jobMatchAgent"
];

const prompts = MODULES.flatMap((module) => Object.entries(require(`./services/${module}`).prompts).map(([name, text]) => ({ name: `${module.split("/")[1]}.${name}`, text })));
const allowed = Object.fromEntries(prompts.map(({ name, text }) => [createHash("sha256").update(text).digest("hex"), name]));

writeFileSync(new URL("../src/allowedPrompts.json", import.meta.url), `${JSON.stringify(allowed, null, 2)}\n`);
console.log(`Allowed ${prompts.length} prompts: ${prompts.map((prompt) => prompt.name).join(", ")}`);
process.exit(0);
