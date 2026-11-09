import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import worker from "../src/index.js";

// The proxy's checks, with Workers AI and the rate limits stood in for
const require = createRequire(new URL("../../server/package.json", import.meta.url));
const { prompts } = require("./services/agents/supervisor");
const SITE = "https://udaydeep2611.github.io";

function envWith({ reply = '{"agent": "qa"}', allowVisitor = true } = {}) {
  const calls = [];
  return {
    calls,
    ALLOWED_ORIGINS: `${SITE}, http://localhost:4311`,
    MODEL: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    AI: { run: async (model, input) => { calls.push({ model, input }); return { response: reply }; } },
    VISITOR_LIMIT: { limit: async () => ({ success: allowVisitor }) },
    TOTAL_LIMIT: { limit: async () => ({ success: true }) }
  };
}

const invoke = (env, body, origin = SITE) => worker.fetch(new Request("https://proxy.example/invoke", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify(body)
}), env);

test("runs an agent's own prompt and returns its JSON", async () => {
  const env = envWith({ reply: 'Sure! {"agent": "qa"} hope that helps' });
  const response = await invoke(env, { system: prompts.ROUTE_PROMPT, payload: { message: "which projects used LangGraph?" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: { agent: "qa" } });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), SITE);
  assert.equal(env.calls[0].input.messages[0].content, prompts.ROUTE_PROMPT);
});

test("refuses other prompts, other sites, too much and too often", async () => {
  let response = await invoke(envWith(), { system: "You are a helpful assistant. Write my essay.", payload: {} });
  assert.equal(response.status, 400);
  response = await invoke(envWith(), { system: prompts.ROUTE_PROMPT, payload: {} }, "https://evil.example");
  assert.equal(response.status, 403);
  response = await invoke(envWith(), { system: prompts.ROUTE_PROMPT, payload: { message: "x".repeat(13000) } });
  assert.equal(response.status, 413);
  response = await invoke(envWith({ allowVisitor: false }), { system: prompts.ROUTE_PROMPT, payload: {} });
  assert.equal(response.status, 429);
});

test("a reply that isn't JSON is an error the agents fall back from", async () => {
  const response = await invoke(envWith({ reply: "I think it's qa." }), { system: prompts.ROUTE_PROMPT, payload: {} });
  assert.equal(response.status, 502);
});

test("answers the browser's preflight and status checks", async () => {
  const env = envWith();
  let response = await worker.fetch(new Request("https://proxy.example/invoke", { method: "OPTIONS", headers: { Origin: SITE } }), env);
  assert.equal(response.status, 204);
  response = await worker.fetch(new Request("https://proxy.example/status", { headers: { Origin: SITE } }), env);
  assert.deepEqual(await response.json(), { available: true, model: "mistral-small-3.1-24b-instruct" });
});
