import { AxiosError } from "axios";

import { jobPilotReply } from "./demoJobLogs";
import { readReply, resetStore, saveStore, storeFor, writeEntry, writeRecord } from "./demoStore";

// The GitHub Pages build has no server. Its demo accounts answer from
// demoData.json instead: replies recorded from a real server for made-up
// people. Edits are kept in the visitor's browser.
const KEY = "uuv-demo-account";
const NEEDS_SERVER = "This needs the full app with its server, so it isn't available in the demo.";

let openAccount = null;

export const demoAccount = () => {
  try {
    return localStorage.getItem(KEY) || openAccount;
  } catch {
    return openAccount;
  }
};

export const startDemo = (id) => {
  openAccount = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Without storage the demo lasts until the page reloads
  }
};

export const endDemo = () => {
  openAccount = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored
  }
};

export const resetDemo = () => resetStore(demoAccount());

const parseBody = (data) => {
  if (typeof data !== "string") return data ?? {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

// The agents (chat, resume chat, buffer zone, custom designs) run the
// server's own code in the browser. Loaded on first use: it's large.
const AGENT_AREAS = ["chat", "resume-chat", "resume-settings", "drafts", "custom-designs"];
async function agentReply(store, account, method, path, search, data) {
  if (!AGENT_AREAS.includes(path.split("/")[2])) return null;
  // Written out so normal builds leave the agents out altogether
  const agents = import.meta.env.VITE_STATIC_SITE === "true" ? await import("./agents/agentReplies") : null;
  if (!agents) return null;
  try {
    return await agents.agentReply(store, account, method, path, search, parseBody(data));
  } catch (error) {
    console.error("Demo agent error:", error);
    return { status: 500, body: { success: false, message: "The agents couldn't answer that. Please try again." } };
  }
}

// Stands in for the network on every API client
export async function demoAdapter(config) {
  const url = config.baseURL ? `${config.baseURL.replace(/\/$/, "")}/${String(config.url || "").replace(/^\//, "")}` : config.url;
  const address = new URL(url);
  new URLSearchParams(config.params || {}).forEach((value, key) => address.searchParams.set(key, value));
  const path = address.pathname.replace(/\/+$/, "");
  const method = (config.method || "get").toLowerCase();
  const reply = (status, data) => ({ data, status, statusText: "", headers: {}, config });
  const refuse = (status, message) => {
    throw new AxiosError(message, "ERR_BAD_REQUEST", config, null, reply(status, { success: false, message }));
  };

  const account = demoAccount();
  if (!account) refuse(401, "Choose a demo account first.");
  if (method === "post" && path === "/api/auth/logout") {
    endDemo();
    return reply(200, { success: true });
  }

  const store = await storeFor(account);

  const agents = await agentReply(store, account, method, path, address.search, config.data);
  if (agents) {
    saveStore(account);
    if (agents.status >= 400) refuse(agents.status, agents.body.message);
    return reply(agents.status, agents.body);
  }

  const jobPilot = await jobPilotReply(store, account, method, path, config.data);
  if (jobPilot) {
    saveStore(account);
    if (jobPilot.status !== 200) refuse(jobPilot.status, jobPilot.body.message);
    return reply(200, jobPilot.body);
  }

  if (method === "get") {
    const found = readReply(store, path, address.search);
    if (found === undefined && path.startsWith("/api/skill-associations/")) return reply(200, { success: true, associations: [] });
    if (found === undefined) refuse(404, "This isn't included in the demo.");
    return reply(200, found);
  }

  // The checks a server would run on the side: nothing to report here
  if (method === "post" && path === "/api/summary/review") return reply(200, { success: true, review: [] });
  if (method === "post" && path === "/api/skills/check") {
    const name = String(parseBody(config.data).name || "").trim().toLowerCase();
    const existing = store["/api/skills"]?.skills.find((skill) => skill.normalizedName === name) || null;
    return reply(200, { success: true, existing, similar: [], suggestion: null, skillType: "technical" });
  }

  if (typeof FormData !== "undefined" && config.data instanceof FormData) refuse(403, "File uploads need the full app, so they aren't available in the demo.");

  const body = parseBody(config.data);
  const written = writeRecord(store, method, path, body) ?? writeEntry(store, method, path, body);
  if (!written) refuse(403, NEEDS_SERVER);
  saveStore(account);
  return reply(200, written);
}

// The streaming calls (AI writing) use fetch rather than an API client
export const demoFetch = async () =>
  new Response(JSON.stringify({ success: false, message: NEEDS_SERVER }), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });
