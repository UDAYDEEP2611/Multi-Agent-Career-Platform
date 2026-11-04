const crypto = require("node:crypto");
const HeroSummary = require("../models/HeroSummary");
const Profile = require("../models/Profile");
const User = require("../models/User");
const { gatherResumeData } = require("../services/resume/resumeData");
const { ollamaStatus, createOllamaLlm } = require("../services/resume/ollama");
const { writeHeroSummaries } = require("../services/portfolio/heroSummaryAgent");
const { DESIGN_IDS, isDesignId } = require("../services/portfolio/heroVoices");

const MAX_TEXT = 400;

// One agent run at a time per user: the local model runs one at a time
const running = new Set();

// Fingerprint of what the summaries are written from
const sourceKeyOf = (summary, headline) =>
  crypto.createHash("sha256").update(`${summary || ""}\n${headline || ""}`).digest("hex").slice(0, 16);

// { [designId]: { text, origin, stale, updatedAt } } for the showcase
async function heroSummariesFor(userId, summary, headline) {
  const doc = await HeroSummary.findOne({ userId }).lean();
  const key = sourceKeyOf(summary, headline);
  return Object.fromEntries((doc?.items || [])
    .filter((item) => isDesignId(item.designId))
    .map((item) => [item.designId, {
      text: item.text,
      origin: item.origin,
      // Hand-edited text is the user's own; it never goes stale
      stale: Boolean(item.sourceKey) && item.sourceKey !== key,
      updatedAt: item.updatedAt
    }]));
}

// Adds or replaces items by design id
async function saveItems(userId, entries) {
  const doc = await HeroSummary.findOne({ userId }) || new HeroSummary({ userId, items: [] });
  const byId = new Map(doc.items.map((item) => [item.designId, item]));
  for (const entry of entries) byId.set(entry.designId, { ...entry, updatedAt: new Date() });
  doc.items = [...byId.values()];
  await doc.save();
  return doc;
}

async function loadSource(userId) {
  const account = await User.findById(userId).select("username email").lean();
  const [source, profile] = await Promise.all([
    gatherResumeData(userId, account),
    Profile.findOne({ userId }, { roleDetails: 1 }).lean()
  ]);
  const roles = profile?.roleDetails || {};
  return {
    source,
    headline: roles.headline?.trim() || source.experiences[0]?.title || "",
    targetRoles: roles.roleTargeting ? [roles.roleTargeting] : []
  };
}

// POST /api/portfolio/hero-summaries/generate { designIds? }
// The hero summary agent writes a summary for each design (all of them when
// designIds is left out). Streams events: "progress" { message }, then
// "result" { heroSummaries, written, notes, model } or "error" { message }.
exports.generateHeroSummaries = async (req, res) => {
  const requested = req.body?.designIds;
  // "All" means the portfolio designs; the resume summary is asked for by name
  const designIds = requested === undefined ? DESIGN_IDS : requested;

  if (!Array.isArray(designIds) || !designIds.length || designIds.length > 60 || !designIds.every(isDesignId)) {
    return res.status(400).json({ success: false, message: "Pick one or more portfolio designs" });
  }

  const userId = String(req.session.userId);
  if (running.has(userId)) {
    return res.status(409).json({ success: false, message: "Already writing your summaries; wait for those to finish" });
  }

  const ai = await ollamaStatus();
  if (!ai.available) return res.status(503).json({ success: false, message: ai.message });

  let loaded;
  try {
    loaded = await loadSource(req.session.userId);
  } catch (error) {
    console.error("Hero summary data error:", error);
    return res.status(500).json({ success: false, message: "Unable to load your portfolio" });
  }

  const { source, headline, targetRoles } = loaded;
  if (!source.summary && !source.experiences.length && !source.projects.length && !source.skills.length) {
    return res.status(400).json({
      success: false,
      message: "Add your About me summary, experience or skills first: the AI writes only from your portfolio"
    });
  }

  running.add(userId);
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Closing the page stops the agent
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const result = await writeHeroSummaries({
      llm: createOllamaLlm(),
      source,
      headline,
      targetRoles,
      designIds: [...new Set(designIds)],
      signal: controller.signal,
      onProgress: (message) => send("progress", { message })
    });

    const sourceKey = sourceKeyOf(source.summary, headline);
    const written = Object.entries(result.summaries);
    if (written.length) {
      await saveItems(req.session.userId, written.map(([designId, text]) => ({
        designId, text: text.slice(0, MAX_TEXT), origin: `AI · ${ai.model}`.slice(0, 60), sourceKey
      })));
    }

    send("result", {
      heroSummaries: await heroSummariesFor(req.session.userId, source.summary, headline),
      written: written.map(([designId]) => designId),
      notes: result.notes,
      model: ai.model
    });
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error("Hero summary error:", error);
      send("error", { message: "Unable to write your summaries right now. Please try again." });
    }
  } finally {
    running.delete(userId);
    res.end();
  }
};

// PUT /api/portfolio/hero-summaries/:designId { text }
// The user's own wording for one design
exports.saveHeroSummary = async (req, res) => {
  const { designId } = req.params;
  const text = typeof req.body?.text === "string" ? req.body.text.replace(/\s+/g, " ").trim() : "";

  if (!isDesignId(designId)) return res.status(404).json({ success: false, message: "That design wasn't found" });
  if (!text || text.length > MAX_TEXT) {
    return res.status(400).json({ success: false, message: `The summary must be 1–${MAX_TEXT} characters` });
  }

  try {
    await saveItems(req.session.userId, [{ designId, text, origin: "Edited by you", sourceKey: "" }]);
    const { source, headline } = await loadSource(req.session.userId);
    res.json({ success: true, heroSummaries: await heroSummariesFor(req.session.userId, source.summary, headline) });
  } catch (error) {
    console.error("Hero summary save error:", error);
    res.status(500).json({ success: false, message: "Unable to save the summary" });
  }
};

// DELETE /api/portfolio/hero-summaries/:designId, or all of them without one.
// The design goes back to the opening of the About me summary.
exports.deleteHeroSummary = async (req, res) => {
  const { designId } = req.params;
  if (designId !== undefined && !isDesignId(designId)) {
    return res.status(404).json({ success: false, message: "That design wasn't found" });
  }

  try {
    const doc = await HeroSummary.findOne({ userId: req.session.userId });
    if (doc) {
      doc.items = designId ? doc.items.filter((item) => item.designId !== designId) : [];
      await doc.save();
    }
    const { source, headline } = await loadSource(req.session.userId);
    res.json({ success: true, heroSummaries: await heroSummariesFor(req.session.userId, source.summary, headline) });
  } catch (error) {
    console.error("Hero summary delete error:", error);
    res.status(500).json({ success: false, message: "Unable to remove the summary" });
  }
};

exports.heroSummariesFor = heroSummariesFor;
