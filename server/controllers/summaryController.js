
const mongoose = require("mongoose");
const Summary = require("../models/Summary");
const User = require("../models/User");
const { gatherResumeData } = require("../services/resume/resumeData");
const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
const { generateSummaryVariants, reviewSummary } = require("../services/resume/summaryVariants");

const HISTORY_LIMIT = 15;

// One AI request at a time per user: the local model runs one at a time
const generating = new Set();

const originOf = (value) =>
  typeof value === "string" ? value.trim().slice(0, 60) : "";

const historyEntry = (summary, id) =>
  summary && mongoose.isValidObjectId(id) ? summary.history.id(id) : null;

// The replaced text goes to the top of history (unless it's identical)
function remember(summary) {
  const latest = summary.history[0];
  if (latest && latest.content === summary.content) return;
  summary.history.unshift({
    content: summary.content,
    origin: summary.origin,
    savedAt: summary.updatedAt || new Date()
  });
  summary.history.splice(HISTORY_LIMIT);
}

const validateContent = (content) =>
  typeof content === "string" &&
  content.trim().length > 0 &&
  content.trim().length <= 5000;

// READ
exports.getSummary = async (req, res) => {
  try {
    const summary = await Summary.findOne({
      userId: req.session.userId
    });

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to load summary"
    });
  }
};

// CREATE
exports.createSummary = async (req, res) => {
  try {
    if (!validateContent(req.body.content)) {
      return res.status(400).json({
        success: false,
        message: "Summary must contain 1–5000 characters"
      });
    }

    const summary = await Summary.create({
      userId: req.session.userId,
      content: req.body.content.trim(),
      origin: originOf(req.body.origin)
    });

    res.status(201).json({ success: true, summary });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A summary already exists for this profile"
      });
    }

    res.status(500).json({
      success: false,
      message: "Unable to create summary"
    });
  }
};

// UPDATE
exports.updateSummary = async (req, res) => {
  try {
    if (!validateContent(req.body.content)) {
      return res.status(400).json({
        success: false,
        message: "Summary must contain 1–5000 characters"
      });
    }

    const summary = await Summary.findOne({ userId: req.session.userId });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Summary not found"
      });
    }

    const content = req.body.content.trim();
    if (content !== summary.content) {
      remember(summary);
      summary.content = content;
      summary.origin = originOf(req.body.origin);
      await summary.save();
    }

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to update summary"
    });
  }
};

// DELETE
exports.deleteSummary = async (req, res) => {
  try {
    const summary = await Summary.findOneAndDelete({
      userId: req.session.userId
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "Summary not found"
      });
    }

    res.json({
      success: true,
      message: "Summary deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to delete summary"
    });
  }
};

// POST /api/summary/history/:historyId/restore
// Brings an earlier version back; the current one moves into history
exports.restoreSummary = async (req, res) => {
  try {
    const summary = await Summary.findOne({ userId: req.session.userId });
    const entry = historyEntry(summary, req.params.historyId);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "That earlier version wasn't found"
      });
    }

    const { content, origin } = entry;
    entry.deleteOne();
    remember(summary);
    summary.content = content;
    summary.origin = origin;
    await summary.save();

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to restore that version"
    });
  }
};

// DELETE /api/summary/history/:historyId
exports.deleteHistoryEntry = async (req, res) => {
  try {
    const summary = await Summary.findOne({ userId: req.session.userId });
    const entry = historyEntry(summary, req.params.historyId);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "That earlier version wasn't found"
      });
    }

    entry.deleteOne();
    await summary.save();

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to remove that version"
    });
  }
};

// POST /api/summary/review { content }
// How a summary covers title, years, skills and achievements (no AI)
exports.reviewSummary = async (req, res) => {
  try {
    const content = typeof req.body.content === "string" ? req.body.content.slice(0, 5000) : "";
    const source = await gatherResumeData(req.session.userId, await User.findById(req.session.userId).select("username email").lean());

    res.json({ success: true, review: content.trim() ? reviewSummary(content, source) : [] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to review summary"
    });
  }
};

// POST /api/summary/generate { targetTitle?, jobDescription?, instructions? }
// Five AI-written versions, built only from the portfolio
exports.generateSummaries = async (req, res) => {
  const { targetTitle = "", jobDescription = "", instructions = "" } = req.body || {};
  const text = (value, max) => typeof value === "string" && value.length <= max;

  if (!text(targetTitle, 120) || !text(jobDescription, 20000) || !text(instructions, 500)) {
    return res.status(400).json({
      success: false,
      message: "Keep the target title under 120 characters, the job description under 20,000 and instructions under 500"
    });
  }

  const userId = String(req.session.userId);
  if (generating.has(userId)) {
    return res.status(409).json({
      success: false,
      message: "Already writing summaries for you; wait for those to finish"
    });
  }

  const ai = await ollamaStatus();
  if (!ai.available) {
    return res.status(503).json({ success: false, message: ai.message });
  }

  generating.add(userId);
  const controller = new AbortController();
  res.on("close", () => !res.writableEnded && controller.abort());

  try {
    const account = await User.findById(req.session.userId).select("username email").lean();
    const source = await gatherResumeData(req.session.userId, account);

    if (!source.experiences.length && !source.projects.length && !source.skills.length && !source.summary) {
      return res.status(400).json({
        success: false,
        message: "Add some experience, projects or skills first: the AI writes only from your portfolio"
      });
    }

    const result = await generateSummaryVariants({
      llm: createOllamaLlm(),
      source,
      targetTitle,
      jobDescription,
      instructions,
      signal: controller.signal
    });

    if (!result.variants.length) {
      return res.status(502).json({
        success: false,
        message: "The AI couldn't write a version that passed the checks. Try again, or add more detail to your portfolio.",
        notes: result.notes
      });
    }

    res.json({ success: true, ...result, model: ai.model });
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Summary generation error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to write summaries right now"
    });
  } finally {
    generating.delete(userId);
  }
};
