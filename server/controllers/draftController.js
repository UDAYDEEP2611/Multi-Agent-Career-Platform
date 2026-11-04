const { listDrafts, updateDraft, discardDraft, confirmDraft } = require("../services/agents/workspace");
const { specOf } = require("../services/agents/sectionSpecs");

// The buffer zone, for the section pages: entries the data entry agent
// prepared, which the user checks, edits, confirms or discards.

const fail = (res, error, message) => {
  console.error(message, error);
  res.status(500).json({ success: false, message });
};

// GET /api/drafts?section=education
exports.getDrafts = async (req, res) => {
  const section = typeof req.query.section === "string" ? req.query.section : "";
  if (section && !specOf(section)) return res.status(400).json({ success: false, message: "Unknown section" });
  try {
    res.json({ success: true, drafts: await listDrafts(req.session.userId, section || undefined) });
  } catch (error) {
    fail(res, error, "Unable to load the buffer");
  }
};

// PATCH /api/drafts/:draftId { data }
exports.updateDraft = async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ success: false, message: "Send the fields to change" });
  try {
    const draft = await updateDraft(req.session.userId, req.params.draftId, data);
    if (!draft) return res.status(404).json({ success: false, message: "That entry isn't in the buffer" });
    res.json({ success: true, draft });
  } catch (error) {
    fail(res, error, "Unable to update the entry");
  }
};

// POST /api/drafts/:draftId/confirm: adds it to the portfolio
exports.confirmDraft = async (req, res) => {
  try {
    const result = await confirmDraft(req.session, req.params.draftId);
    res.status(result.status).json({ success: result.status < 400, ...result });
  } catch (error) {
    fail(res, error, "Unable to add the entry");
  }
};

// DELETE /api/drafts/:draftId
exports.discardDraft = async (req, res) => {
  try {
    if (!(await discardDraft(req.session.userId, req.params.draftId))) {
      return res.status(404).json({ success: false, message: "That entry isn't in the buffer" });
    }
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "Unable to discard the entry");
  }
};
