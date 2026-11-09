import { connectForUser } from "../../../../server/mcp/userToolClient";
import { sanitizePlan } from "../../../../server/services/agents/designPlanner";
import { base, modelFor } from "../../../../server/services/agents/ml/intentEnsemble";
import { runResumeCustomizer } from "../../../../server/services/agents/resumeCustomizer";
import { specOf } from "../../../../server/services/agents/sectionSpecs";
import { runSupervisor } from "../../../../server/services/agents/supervisor";
import { modelCard } from "../../../../server/services/nlp/trainedModels";
import { createOllamaLlm, ollamaStatus } from "./shims/ollama";
import { newId } from "../demoStore";
import { openAccount } from "./current";
import * as workspace from "./workspace";

// The server's agent endpoints, in the browser: the same LangGraph agents
// and MCP tools, on the demo data. The language model is the AI proxy when
// the build has one (see shims/ollama.js); otherwise the agents use their
// rules and trained models, as the full app does when Ollama isn't running.

const AGENTS = ["entry", "design", "qa"];
const MAX_MESSAGES = 120;
const MAX_TEXT = 2000;

const ok = (body, status = 200) => ({ status, body: { success: true, ...body } });
const fail = (status, message) => ({ status, body: { success: false, message } });

// The user's intent model: the base model, retrained with their corrections
const events = (store) => (store.intentEvents ||= []);
const intentModelFor = (store, account) => modelFor(account, events(store).filter((item) => item.correctedTo).slice(-300).map((item) => ({ text: item.text, label: item.correctedTo })));
const modelSummary = (model) => ({
  version: model.version,
  examples: model.examples,
  corrections: model.feedback,
  accuracy: model.metrics?.ensembleAccuracy ?? base.metrics.ensembleAccuracy
});

const thread = (store) => (store.chatThread ||= { messages: [], pending: null });
const pendingView = (pending) => (pending ? { section: pending.section, asked: pending.asked } : null);
const messageView = (message) => ({ choices: [], links: [], sources: [], steps: [], ...message });

const toolsFor = (account, store) => connectForUser({ id: account, username: store["/api/auth/me"]?.user?.username || account, email: store["/api/auth/me"]?.user?.email || "" });

async function chatMessage(store, account, body) {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const mode = ["auto", "entry", "design", "qa"].includes(body?.mode) ? body.mode : "auto";
  const path = typeof body?.context?.path === "string" ? body.context.path.slice(0, 200) : "";
  if (!text || text.length > MAX_TEXT) return fail(400, `Write a message of 1–${MAX_TEXT} characters`);

  const chat = thread(store);
  const intentModel = intentModelFor(store, account);
  const ai = await ollamaStatus();
  const tools = await toolsFor(account, store);
  try {
    const result = await runSupervisor({ text, mode, pending: chat.pending, context: { path }, llm: ai.available ? createOllamaLlm() : null, tools, intentModel });
    const now = new Date().toISOString();
    const added = [
      { id: newId(), role: "user", agent: "", text: body?.rerunAs ? `↻ ${text}` : text, createdAt: now },
      {
        id: newId(),
        role: "assistant",
        agent: result.agent,
        text: result.reply,
        choices: result.choices.slice(0, 10),
        links: result.links.slice(0, 4),
        sources: result.sources.slice(0, 6),
        steps: result.steps.slice(0, 20),
        createdAt: now
      }
    ];
    chat.messages.push(...added);
    chat.messages.splice(0, Math.max(0, chat.messages.length - MAX_MESSAGES));
    chat.pending = result.pending || null;

    // Every routing decision is kept, so "Not what I meant" can retrain
    if (result.decision) {
      events(store).push({
        messageId: added[1].id,
        text: (result.routedText || text).slice(0, 2000),
        predicted: result.decision.predicted,
        confidence: Math.max(0, Math.min(1, result.decision.confidence || 0)),
        decidedBy: result.decision.decidedBy,
        modelVersion: result.decision.modelVersion || intentModel.version,
        correctedTo: "",
        createdAt: now
      });
      store.intentEvents = events(store).slice(-300);
    }
    return ok({
      messages: added.map(messageView),
      pending: pendingView(chat.pending),
      changed: {
        buffer: result.agent === "data-entry" && result.links.length > 0,
        designs: result.changed,
        designId: result.designId
      },
      ai: { available: ai.available, model: ai.model },
      intentModel: modelSummary(intentModel)
    });
  } finally {
    await tools.close().catch(() => {});
  }
}

async function chatFeedback(store, account, body) {
  const { messageId, agent } = body || {};
  if (typeof messageId !== "string" || !AGENTS.includes(agent)) return fail(400, "Say which message and which agent it was meant for");
  const event = events(store).find((item) => item.messageId === messageId);
  if (!event) return fail(404, "That message can't be corrected");
  if (event.predicted === agent && !event.correctedTo) return fail(400, "That message already went to that agent");
  event.correctedTo = agent;
  thread(store).pending = null;
  return chatMessage(store, account, { text: event.text, mode: agent, context: body.context, rerunAs: agent });
}

function modelMetrics(store, account) {
  const model = intentModelFor(store, account);
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = events(store).filter((item) => Date.parse(item.createdAt) >= since);
  const routed = recent.filter((item) => ["ensemble", "language model", "asked"].includes(item.decidedBy));
  const corrected = recent.filter((item) => item.correctedTo);
  return ok({
    model: {
      version: model.version,
      trainedAt: model.trainedAt,
      examples: model.examples,
      corrections: model.feedback,
      crossValidation: model.metrics || base.metrics,
      trained: modelCard()
    },
    live: {
      days: 30,
      decisions: routed.length,
      byDecider: routed.reduce((counts, item) => ({ ...counts, [item.decidedBy]: (counts[item.decidedBy] || 0) + 1 }), {}),
      averageConfidence: routed.length ? routed.reduce((sum, item) => sum + item.confidence, 0) / routed.length : null,
      corrections: corrected.length,
      correctionRate: routed.length ? corrected.length / routed.length : null
    }
  });
}

async function resumeChat(store, account, designId, body) {
  const text = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim() : "";
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(designId)) return fail(400, "Unknown resume design");
  if (!text || text.length > 1000) return fail(400, "Send a message of 1–1000 characters");

  const ai = await ollamaStatus();
  const tools = await toolsFor(account, store);
  try {
    const result = await runResumeCustomizer({
      text,
      designId,
      layout: ["left", "right", "single"].includes(body?.layout) ? body.layout : "",
      sideWidth: Number.isFinite(body?.sideWidth) && body.sideWidth >= 10 && body.sideWidth <= 60 ? body.sideWidth : 0,
      llm: ai.available ? createOllamaLlm() : null,
      tools
    });
    return ok({ ...result, settings: await workspace.getResumeSettings(), ai: { available: ai.available, model: ai.model } });
  } finally {
    await tools.close().catch(() => {});
  }
}

async function customDesignSave(store, account, action, designId, body) {
  const changes = body?.changes;
  if (changes !== undefined && (typeof changes !== "object" || Array.isArray(changes))) return fail(400, "Send the changes as an object");
  const custom = await workspace.listCustomDesigns();
  const plan = sanitizePlan({ action, targetId: designId, baseId: body?.baseId, changes: changes || {} }, custom, designId || "");
  if (action === "update" && plan.targetId !== designId) return fail(404, "Design not found");
  try {
    const result = await workspace.applyDesignPlan(account, plan);
    if (!result.design) return fail(404, "Design not found");
    return ok({ design: result.design, notes: plan.notes }, action === "create" ? 201 : 200);
  } catch (error) {
    return fail(400, error.message);
  }
}

// The reply to an agent endpoint, or null if the path isn't one.
// { status, body }; the caller saves the demo data afterwards.
export async function agentReply(store, account, method, path, search, body) {
  openAccount(account, store);
  const parts = path.split("/").slice(2);
  const [area, id, action] = parts;

  if (area === "chat") {
    if (method === "get" && !id) {
      const chat = thread(store);
      const ai = await ollamaStatus();
      return ok({ messages: chat.messages.map(messageView), pending: pendingView(chat.pending), ai: { available: ai.available, model: ai.model, message: ai.message }, intentModel: modelSummary(intentModelFor(store, account)) });
    }
    if (method === "get" && id === "model") return modelMetrics(store, account);
    if (method === "post" && id === "message") return chatMessage(store, account, body);
    if (method === "post" && id === "feedback") return chatFeedback(store, account, body);
    if (method === "delete" && !id) {
      store.chatThread = { messages: [], pending: null };
      return ok({});
    }
  }

  if (area === "resume-chat") {
    if (method === "get" && id === "status") {
      const ai = await ollamaStatus();
      return ok({ ai: { available: ai.available, model: ai.model } });
    }
    if (method === "post" && id) return resumeChat(store, account, id, body);
  }

  if (area === "resume-settings") {
    if (method === "get") return ok({ settings: await workspace.getResumeSettings() });
    if (method === "patch") {
      const { designId = "", ...changes } = body || {};
      try {
        return ok({ settings: await workspace.updateResumeSettings(account, changes, designId) });
      } catch (error) {
        return fail(400, error.message);
      }
    }
  }

  if (area === "drafts") {
    if (method === "get" && !id) {
      const section = new URLSearchParams(search).get("section") || "";
      if (section && !specOf(section)) return fail(400, "Unknown section");
      return ok({ drafts: await workspace.listDrafts(account, section || undefined) });
    }
    if (method === "patch" && id) {
      const data = body?.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return fail(400, "Send the fields to change");
      const draft = await workspace.updateDraft(account, id, data);
      return draft ? ok({ draft }) : fail(404, "That entry isn't in the buffer");
    }
    if (method === "post" && id && action === "confirm") {
      const result = await workspace.confirmDraft({ userId: account }, id);
      return { status: result.status, body: { success: result.status < 400, ...result } };
    }
    if (method === "delete" && id) return (await workspace.discardDraft(account, id)) ? ok({}) : fail(404, "That entry isn't in the buffer");
  }

  if (area === "custom-designs") {
    if (method === "get" && !id) return ok({ designs: await workspace.listCustomDesigns() });
    if (method === "get") {
      const design = await workspace.getCustomDesign(account, id);
      return design ? ok({ design }) : fail(404, "Design not found");
    }
    if (method === "post" && !id) return customDesignSave(store, account, "create", "", body);
    if (method === "patch" && id) return customDesignSave(store, account, "update", id, body);
    if (method === "delete" && id) return (await workspace.deleteCustomDesign(account, id)) ? ok({}) : fail(404, "Design not found");
  }

  return null;
}
