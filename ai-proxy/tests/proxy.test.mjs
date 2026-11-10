import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import worker from "../src/index.js";

// The proxy's checks, with Workers AI and the rate limits stood in for
const require = createRequire(new URL("../../server/package.json", import.meta.url));
const { prompts } = require("./services/agents/supervisor");
const SITE = "https://udaydeep2611.github.io";

let envStore = new Map();
function envWith({ reply = '{"agent": "qa"}', allowVisitor = true } = {}) {
  const calls = [];
  envStore = new Map();
  return {
    calls,
    ALLOWED_ORIGINS: `${SITE}, http://localhost:4311`,
    MODEL: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    AI: { run: async (model, input) => { calls.push({ model, input }); return { response: reply }; } },
    VISITOR_LIMIT: { limit: async () => ({ success: allowVisitor }) },
    TOTAL_LIMIT: { limit: async () => ({ success: true }) },
    FORM_LIMIT: { limit: async () => ({ success: allowVisitor }) },
    SUBMISSIONS: {
      get: async (key) => envStore.get(key) ?? null,
      put: async (key, value) => envStore.set(key, value)
    }
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
  response = await invoke(envWith(), { system: prompts.ROUTE_PROMPT, payload: { message: "x".repeat(25000) } });
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

const post = (env, path, body, origin = SITE) => worker.fetch(new Request(`https://proxy.example${path}`, {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify(body)
}), env);

test("the contact form and sign-ups are kept as JSON, checked like the server does", async () => {
  const env = envWith();
  let response = await post(env, "/contact", { name: "Ada Lovelace", email: "ada@example.com", message: "I'd like to know more about JobPilot." });
  assert.equal(response.status, 201);
  const [key, value] = [...envStore][0];
  assert.match(key, /^contact:\d{4}-/);
  assert.deepEqual({ ...JSON.parse(value), at: undefined }, { type: "contact", name: "Ada Lovelace", email: "ada@example.com", phone: "", message: "I'd like to know more about JobPilot.", at: undefined });

  response = await post(env, "/contact", { name: "Ada", email: "not-an-email", message: "Hello there, a question" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /valid email/);
  // Bots fill the hidden field: same reply, nothing kept
  response = await post(env, "/contact", { name: "Bot", email: "bot@example.com", message: "Buy things now please", website: "spam.example" });
  assert.equal(response.status, 201);
  assert.equal(envStore.size, 1);

  await post(env, "/subscribe", { email: "Ada@Example.com" });
  await post(env, "/subscribe", { email: "ada@example.com" });
  assert.equal([...envStore.keys()].filter((name) => name.startsWith("subscriber:")).length, 1, "signing up twice keeps one");
  assert.equal(JSON.parse(envStore.get("subscriber:ada@example.com")).email, "ada@example.com");

  assert.equal((await post(env, "/subscribe", { email: "x@example.com" }, "https://evil.example")).status, 403);
  assert.equal((await post(envWith({ allowVisitor: false }), "/contact", { name: "A", email: "a@example.com", message: "Hello hello hello" })).status, 429);
});
