const ChatThread = require("../models/ChatThread");
const User = require("../models/User");
const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
const { connectForUser } = require("../mcp/userToolClient");
const { runSupervisor } = require("../services/agents/supervisor");
const IntentEvent = require("../models/IntentEvent");
const { modelFor, base } = require("../services/agents/ml/intentEnsemble");
const { modelCard } = require("../services/nlp/trainedModels");

const AGENTS = ["entry", "design", "qa"];

// The user's intent model: the base model, retrained with their corrections
async function intentModelFor(userId) {
  const corrections = await IntentEvent.find({ userId, correctedTo: { $ne: "" } }, { text: 1, correctedTo: 1 })
    .sort({ createdAt: -1 }).limit(300).lean();
  return modelFor(userId, corrections.map((item) => ({ text: item.text, label: item.correctedTo })));
}

const modelSummary = (model) => ({
  version: model.version,
  examples: model.examples,
  corrections: model.feedback,
  accuracy: model.metrics?.ensembleAccuracy ?? base.metrics.ensembleAccuracy
});

const MAX_MESSAGES = 120;
const MAX_TEXT = 2000;

// One message at a time per user: the agents share one thread
const busy = new Set();

const messageView = (message) => ({
  id: String(message._id),
  role: message.role,
  agent: message.agent,
  text: message.text,
  choices: message.choices || [],
  links: message.links || [],
  sources: message.sources || [],
  steps: message.steps || [],
  createdAt: message.createdAt
});

async function threadFor(userId) {
  return (await ChatThread.findOne({ userId })) || new ChatThread({ userId, messages: [] });
}

// GET /api/chat
exports.getThread = async (req, res) => {
  try {
    const thread = await ChatThread.findOne({ userId: req.session.userId }).lean();
    const ai = await ollamaStatus();
    res.json({
      success: true,
      messages: (thread?.messages || []).map(messageView),
      pending: thread?.pending ? { section: thread.pending.section, asked: thread.pending.asked } : null,
      ai: { available: ai.available, model: ai.model, message: ai.message },
      intentModel: modelSummary(await intentModelFor(req.session.userId))
    });
  } catch (error) {
    console.error("Chat load error:", error);
    res.status(500).json({ success: false, message: "Unable to load the chat" });
  }
};

// POST /api/chat/message { text, mode?, context? }
// mode: "auto" (the supervisor picks) or "entry", "design", "qa"
exports.sendMessage = async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const mode = ["auto", "entry", "design", "qa"].includes(req.body?.mode) ? req.body.mode : "auto";
  const path = typeof req.body?.context?.path === "string" ? req.body.context.path.slice(0, 200) : "";

  if (!text || text.length > MAX_TEXT) {
    return res.status(400).json({ success: false, message: `Write a message of 1–${MAX_TEXT} characters` });
  }

  const userId = String(req.session.userId);
  if (busy.has(userId)) return res.status(409).json({ success: false, message: "Still working on your last message" });
  busy.add(userId);

  const controller = new AbortController();
  res.on("close", () => !res.writableEnded && controller.abort());
  let tools;

  try {
    const account = await User.findById(userId).select("username email").lean();
    const thread = await threadFor(userId);
    const ai = await ollamaStatus();
    tools = await connectForUser({ id: userId, username: account.username, email: account.email });

    const intentModel = await intentModelFor(userId);
    const result = await runSupervisor({
      text,
      mode,
      pending: thread.pending || null,
      context: { path },
      llm: ai.available ? createOllamaLlm() : null,
      tools,
      signal: controller.signal,
      intentModel
    });

    // A re-run after "Not what I meant" shows which agent it went to
    thread.messages.push({ role: "user", text: req.body?.rerunAs ? `↻ ${text}` : text });
    thread.messages.push({
      role: "assistant",
      agent: result.agent,
      text: result.reply,
      choices: result.choices.slice(0, 10),
      links: result.links.slice(0, 4),
      sources: result.sources.slice(0, 6),
      steps: result.steps.slice(0, 20)
    });
    thread.messages.splice(0, Math.max(0, thread.messages.length - MAX_MESSAGES));
    thread.pending = result.pending || null;
    thread.markModified("pending");
    await thread.save();

    const added = thread.messages.slice(-2).map(messageView);

    // MLOps: every routing decision is logged with its confidence and model
    if (result.decision) {
      await IntentEvent.create({
        userId,
        messageId: added[1].id,
        text: (result.routedText || text).slice(0, 2000),
        predicted: result.decision.predicted,
        confidence: Math.max(0, Math.min(1, result.decision.confidence || 0)),
        decidedBy: result.decision.decidedBy,
        modelVersion: result.decision.modelVersion || intentModel.version
      });
    }
    res.json({
      success: true,
      messages: added,
      pending: thread.pending ? { section: thread.pending.section, asked: thread.pending.asked } : null,
      // What the page should refresh
      changed: {
        buffer: result.agent === "data-entry" && result.links.length > 0,
        designs: result.changed,
        designId: result.designId
      },
      ai: { available: ai.available, model: ai.model },
      intentModel: modelSummary(intentModel)
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Chat error:", error);
    res.status(500).json({ success: false, message: "The agents couldn't answer that. Please try again." });
  } finally {
    busy.delete(userId);
    tools?.close().catch(() => {});
  }
};

// DELETE /api/chat: starts a fresh conversation
exports.clearThread = async (req, res) => {
  try {
    await ChatThread.deleteOne({ userId: req.session.userId });
    res.json({ success: true });
  } catch (error) {
    console.error("Chat clear error:", error);
    res.status(500).json({ success: false, message: "Unable to clear the chat" });
  }
};

// POST /api/chat/feedback { messageId, agent }
// "Not what I meant": records the correction (training data for the
// user's intent model), then runs the same message with the right agent
exports.sendFeedback = async (req, res) => {
  const { messageId, agent } = req.body || {};
  if (typeof messageId !== "string" || !AGENTS.includes(agent)) {
    return res.status(400).json({ success: false, message: "Say which message and which agent it was meant for" });
  }

  const userId = String(req.session.userId);
  const event = await IntentEvent.findOne({ userId, messageId });
  if (!event) return res.status(404).json({ success: false, message: "That message can't be corrected" });
  if (event.predicted === agent && !event.correctedTo) {
    return res.status(400).json({ success: false, message: "That message already went to that agent" });
  }

  event.correctedTo = agent;
  await event.save();

  // Run it again with the agent the user meant; the thread's unfinished
  // entry (if the wrong agent started one) is dropped first
  const thread = await threadFor(userId);
  if (thread.pending) {
    thread.pending = null;
    thread.markModified("pending");
    await thread.save();
  }
  req.body = { text: event.text, mode: agent, context: req.body.context, rerunAs: agent };
  return exports.sendMessage(req, res);
};

// GET /api/chat/model: the intent model's version and metrics
exports.getModelMetrics = async (req, res) => {
  try {
    const userId = req.session.userId;
    const model = await intentModelFor(userId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await IntentEvent.find({ userId, createdAt: { $gte: since } }, { predicted: 1, confidence: 1, decidedBy: 1, correctedTo: 1 }).lean();
    const routed = events.filter((item) => ["ensemble", "language model", "asked"].includes(item.decidedBy));
    const corrected = events.filter((item) => item.correctedTo);
    res.json({
      success: true,
      model: {
        version: model.version,
        trainedAt: model.trainedAt,
        examples: model.examples,
        corrections: model.feedback,
        crossValidation: model.metrics || base.metrics,
        // The models trained in ml/train.py, compared on hand-written sentences
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
  } catch (error) {
    console.error("Intent model metrics error:", error);
    res.status(500).json({ success: false, message: "Unable to load the model metrics" });
  }
};
