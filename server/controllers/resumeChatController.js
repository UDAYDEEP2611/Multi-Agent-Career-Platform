const User = require("../models/User");
const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
const { connectForUser } = require("../mcp/userToolClient");
const { runResumeCustomizer } = require("../services/agents/resumeCustomizer");
const { getResumeSettings } = require("../services/agents/workspace");

// One message at a time per user: the local model runs one at a time
const busy = new Set();

// GET /api/resume-chat/status: whether the language model is running (the
// agent falls back to its rules when it isn't)
exports.getStatus = async (req, res) => {
  const ai = await ollamaStatus().catch(() => ({ available: false }));
  res.json({ success: true, ai: { available: Boolean(ai.available), model: ai.model || "" } });
};

// POST /api/resume-chat/:designId { message, layout, sideWidth }
// The AI chat on one designed resume: the resume customizer agent changes
// that resume (or all of them, or the portfolio when asked) through MCP.
// Returns { reply, steps, changed, settings, ai }.
exports.sendMessage = async (req, res) => {
  const { designId } = req.params;
  const text = typeof req.body?.message === "string" ? req.body.message.replace(/\s+/g, " ").trim() : "";
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(designId)) return res.status(400).json({ success: false, message: "Unknown resume design" });
  if (!text || text.length > 1000) return res.status(400).json({ success: false, message: "Send a message of 1–1000 characters" });

  const userId = String(req.session.userId);
  if (busy.has(userId)) return res.status(409).json({ success: false, message: "Still working on your last message" });
  busy.add(userId);

  const controller = new AbortController();
  res.on("close", () => !res.writableEnded && controller.abort());
  let tools;
  try {
    const account = await User.findById(userId).select("username email").lean();
    const ai = await ollamaStatus();
    tools = await connectForUser({ id: userId, username: account.username, email: account.email });
    const result = await runResumeCustomizer({
      text,
      designId,
      layout: ["left", "right", "single"].includes(req.body?.layout) ? req.body.layout : "",
      // The design's own sidebar width, % of the page
      sideWidth: Number.isFinite(req.body?.sideWidth) && req.body.sideWidth >= 10 && req.body.sideWidth <= 60 ? req.body.sideWidth : 0,
      llm: ai.available ? createOllamaLlm() : null,
      tools,
      signal: controller.signal
    });
    return res.json({
      success: true,
      ...result,
      settings: await getResumeSettings(userId),
      ai: { available: ai.available, model: ai.model || "" }
    });
  } catch (error) {
    if (controller.signal.aborted) return undefined;
    console.error("Resume chat error:", error);
    return res.status(500).json({ success: false, message: "Unable to change this resume right now. Please try again." });
  } finally {
    busy.delete(userId);
    await tools?.close().catch(() => {});
  }
};
