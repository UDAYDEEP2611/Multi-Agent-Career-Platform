import { generateCv, parseOptions, parseRevision, pickSource, reviseCv } from "../../../../server/services/resume/cvMaker";
import { refitSummary } from "../../../../server/services/resume/summaryFit";
import { gather } from "../demoStore";
import { openAccount } from "./current";
import { createOllamaLlm, ollamaStatus } from "./shims/ollama";

// CV Maker in the demo: the server's own steps (services/resume/cvMaker.js) on
// the demo person's data, with the AI proxy as the language model when it's
// available.

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// The AI as CV Maker shows it
async function aiStatus() {
  const status = await ollamaStatus();
  return status.available
    ? { available: true, model: status.model, message: "" }
    : { available: false, model: "", message: "The AI isn't available right now, so the resume is built from your portfolio as written." };
}

// GET /api/resume/sources, POST /api/resume/summary-fit: { status, body } or null
export async function cvMakerReply(store, account, method, path, body) {
  openAccount(account, store);
  if (method === "get" && path === "/api/resume/sources") return { status: 200, body: { success: true, sources: gather(store, "resume"), ai: await aiStatus() } };
  if (method === "post" && path === "/api/resume/summary-fit") {
    const { resume, summary, targetWords, feedback } = body || {};
    const words = Number(targetWords);
    if (!resume || typeof summary !== "string" || !summary.trim() || !Number.isInteger(words) || words < 30 || words > 160) {
      return { status: 400, body: { success: false, message: "Send the summary to rephrase" } };
    }
    if (!(await aiStatus()).available) return { status: 503, body: { success: false, message: "The AI isn't available right now." } };
    const result = await refitSummary({ llm: createOllamaLlm(), resume, summary: summary.trim(), targetWords: words, feedback: typeof feedback === "string" ? feedback.slice(0, 300) : "" });
    return result.error ? { status: 422, body: { success: false, message: result.error } } : { status: 200, body: { success: true, summary: result.summary } };
  }
  return null;
}

// POST /api/resume/generate and /revise: a Response streaming the same events
// as the server ("progress", then "result", "clarify" or "error")
export async function cvMakerStream(store, account, path, body, signal) {
  openAccount(account, store);
  const { options, ids, error } = parseOptions(body);
  if (error) return json(400, { success: false, message: error });
  const revising = path.endsWith("/revise");
  const revision = revising ? parseRevision(body) : null;
  if (revision?.error) return json(400, { success: false, message: revision.error });
  const ai = await aiStatus();
  if ((revising || options.useAi) && !ai.available) return json(503, { success: false, message: ai.message });

  const source = pickSource(gather(store, "resume"), options, ids);
  const llm = revising || options.useAi ? createOllamaLlm() : null;
  const encoder = new TextEncoder();

  return new Response(new ReadableStream({
    async start(controller) {
      const send = (event, data) => controller.enqueue(encoder.encode(sse(event, data)));
      try {
        if (revising) await reviseCv({ source, options, revision, llm, signal, send });
        else await generateCv({ source, options, llm, signal, send });
      } catch (buildError) {
        if (!signal?.aborted) {
          console.error("Demo CV Maker error:", buildError);
          send("error", { message: `Unable to ${revising ? "revise" : "build"} the resume. Please try again.` });
        }
      } finally {
        controller.close();
      }
    }
  }), { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
