// Writes src/allowedPrompts.json: the SHA-256 of every system prompt the demo's
// agents send. The proxy runs only those prompts, so it can't be used as a
// general-purpose free model. Run again whenever a prompt changes (deploy does).
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../server/package.json", import.meta.url));
const AGENTS = ["supervisor", "dataEntryAgent", "qaAgent", "designPlanner", "resumeCustomizer"];

const prompts = AGENTS.flatMap((agent) => Object.entries(require(`./services/agents/${agent}`).prompts).map(([name, text]) => ({ name: `${agent}.${name}`, text })));
const allowed = Object.fromEntries(prompts.map(({ name, text }) => [createHash("sha256").update(text).digest("hex"), name]));

writeFileSync(new URL("../src/allowedPrompts.json", import.meta.url), `${JSON.stringify(allowed, null, 2)}\n`);
console.log(`Allowed ${prompts.length} prompts: ${prompts.map((prompt) => prompt.name).join(", ")}`);
process.exit(0);
