import allowedPrompts from "./allowedPrompts.json" with { type: "json" };
import { formReply } from "./forms.js";

// The language model for the GitHub Pages demo. The demo's agents run in
// the visitor's browser; when they want the model, they send their system
// prompt and JSON payload here and get JSON back, as they would from Ollama.
//
//   GET  /status     { available, model }
//   POST /invoke     { system, payload } -> { reply }
//   POST /contact    the Contact Us form, kept as JSON (src/forms.js)
//   POST /subscribe  the newsletter sign-up, kept as JSON
//
// Only the agents' own prompts are run (src/allowedPrompts.json), only for
// the allowed sites, with per-visitor and total rate limits and size caps.

// characters of JSON: a CV Maker call carries the job description and bullets
const MAX_PAYLOAD = 24000;
const MAX_TOKENS = 1024;

const allowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  return env.ALLOWED_ORIGINS.split(",").map((item) => item.trim()).includes(origin) ? origin : "";
};

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {})
  }
});

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// The model's text, from the shapes Workers AI models reply in
const replyText = (result) => (typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? ""));

const parseJson = (text) => {
  const raw = String(text || "");
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
};

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return json({ error: "This site can't use the proxy" }, 403, "");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin"
        }
      });
    }

    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/status") return json({ available: true, model: env.MODEL.split("/").pop() }, 200, origin);

    if (request.method === "POST" && ["/contact", "/subscribe"].includes(pathname)) {
      const visitor = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await env.FORM_LIMIT.limit({ key: visitor })).success) return json({ success: false, message: "Too many tries; wait a minute and try again." }, 429, origin);
      let body;
      try {
        body = JSON.parse((await request.text()).slice(0, 10000));
      } catch {
        return json({ success: false, message: "Send the form as JSON" }, 400, origin);
      }
      const reply = await formReply(pathname, body, env);
      return json(reply.body, reply.status, origin);
    }
    if (request.method !== "POST" || pathname !== "/invoke") return json({ error: "Not found" }, 404, origin);

    const visitor = request.headers.get("CF-Connecting-IP") || "unknown";
    const [mine, total] = await Promise.all([env.VISITOR_LIMIT.limit({ key: visitor }), env.TOTAL_LIMIT.limit({ key: "all" })]);
    if (!mine.success || !total.success) return json({ error: "Too many requests; try again in a minute" }, 429, origin);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Send JSON" }, 400, origin);
    }
    const system = typeof body?.system === "string" ? body.system : "";
    const payload = JSON.stringify(body?.payload ?? {});
    if (!allowedPrompts[await sha256(system)]) return json({ error: "Unknown prompt" }, 400, origin);
    if (payload.length > MAX_PAYLOAD) return json({ error: "Too long" }, 413, origin);

    try {
      const result = await env.AI.run(env.MODEL, {
        messages: [{ role: "system", content: system }, { role: "user", content: payload }],
        max_tokens: MAX_TOKENS,
        temperature: 0.3
      });
      return json({ reply: parseJson(replyText(result)) }, 200, origin);
    } catch {
      // The agents fall back to their rules
      return json({ error: "The model didn't answer with JSON" }, 502, origin);
    }
  }
};
