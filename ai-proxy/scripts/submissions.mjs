// Downloads the demo's Contact Us messages and newsletter sign-ups from
// Workers KV into submissions.json (not committed: it holds people's details).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const wrangler = (...args) => execFileSync("npx", ["wrangler", "kv", ...args, "--binding", "SUBMISSIONS", "--remote"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const keys = JSON.parse(wrangler("key", "list")).map((entry) => entry.name);
const items = keys.map((key) => JSON.parse(wrangler("key", "get", key)));
const data = {
  downloadedAt: new Date().toISOString(),
  contact: items.filter((item) => item.type === "contact").sort((a, b) => b.at.localeCompare(a.at)),
  subscribers: items.filter((item) => item.type === "subscriber").sort((a, b) => b.at.localeCompare(a.at))
};
writeFileSync(new URL("../submissions.json", import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
console.log(`Saved ${data.contact.length} messages and ${data.subscribers.length} subscribers to ai-proxy/submissions.json`);
