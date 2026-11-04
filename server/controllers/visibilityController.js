const { setEntryVisibility, SECTION_IDS } = require("../services/portfolio/entryVisibility");

// PATCH /api/visibility/:section/:id  { showInPortfolio?, showInResume? }
// Whether one entry shows on the portfolio websites and on resumes
exports.updateVisibility = async (req, res) => {
  const { section, id } = req.params;
  if (!SECTION_IDS.includes(section)) return res.status(404).json({ success: false, message: "Unknown section" });
  try {
    const entry = await setEntryVisibility(req.session.userId, section, id, req.body || {});
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });
    return res.json({ success: true, entry });
  } catch (error) {
    if (/must be|Send /.test(error.message)) return res.status(400).json({ success: false, message: error.message });
    console.error("Visibility error:", error);
    return res.status(500).json({ success: false, message: "Unable to save this setting" });
  }
};
