const { getResumeSettings, updateResumeSettings } = require("../services/agents/workspace");

// What the designed resumes include (the resume page's switches; the
// assistant changes it through MCP)

// GET /api/resume-settings
exports.getSettings = async (req, res) => {
  try {
    res.json({ success: true, settings: await getResumeSettings(req.session.userId) });
  } catch (error) {
    console.error("Resume settings error:", error);
    res.status(500).json({ success: false, message: "Unable to load your resume settings" });
  }
};

// PATCH /api/resume-settings { limits?, show?, hide?, allSkills? }
// With designId, one resume design's own changes instead, which also take
// hideEntries / showEntries (["projects:<id>"]), accent and reset
exports.updateSettings = async (req, res) => {
  const { limits, show, hide, allSkills, columns, designId, hideEntries, showEntries, hideFields, showFields, skillStyle, order, rewrite, tweaks, accent, reset } = req.body || {};
  const list = (value) => value === undefined || (Array.isArray(value) && value.length <= 200 && value.every((item) => typeof item === "string"));
  if ((limits !== undefined && (typeof limits !== "object" || Array.isArray(limits))) || !list(show) || !list(hide) ||
      (columns !== undefined && (!columns || typeof columns !== "object" || Array.isArray(columns))) ||
      !list(hideEntries) || !list(showEntries) || !list(hideFields) || !list(showFields) || !list(order) ||
      (skillStyle !== undefined && typeof skillStyle !== "string") ||
      (tweaks !== undefined && (!tweaks || typeof tweaks !== "object" || Array.isArray(tweaks))) ||
      (rewrite !== undefined && (!rewrite || typeof rewrite !== "object" || Array.isArray(rewrite))) ||
      (allSkills !== undefined && typeof allSkills !== "boolean") ||
      (designId !== undefined && typeof designId !== "string") ||
      (accent !== undefined && (typeof accent !== "string" || !/^(#[0-9a-fA-F]{6})?$/.test(accent))) ||
      (reset !== undefined && typeof reset !== "boolean")) {
    return res.status(400).json({ success: false, message: "Send limits, show, hide or allSkills (and designId for one resume)" });
  }
  try {
    const settings = await updateResumeSettings(
      req.session.userId,
      { limits, show, hide, allSkills, columns, hideEntries, showEntries, hideFields, showFields, skillStyle, order, rewrite, tweaks, accent, reset },
      designId || ""
    );
    res.json({ success: true, settings });
  } catch (error) {
    if (error.message === "Unknown resume design") return res.status(400).json({ success: false, message: error.message });
    console.error("Resume settings error:", error);
    res.status(500).json({ success: false, message: "Unable to save your resume settings" });
  }
};
