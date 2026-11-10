const ChatThread = require("../models/ChatThread");
const { undoChanges } = require("../services/agents/workspace");

// POST /api/agent-changes/undo { changeId }
// Undoes the changes one chat answer made, if they're the latest
exports.undoChange = async (req, res) => {
  const changeId = typeof req.body?.changeId === "string" ? req.body.changeId.slice(0, 64) : "";
  if (!changeId) return res.status(400).json({ success: false, message: "Say which change to undo" });
  try {
    const userId = req.session.userId;
    const result = await undoChanges(userId, changeId);
    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.message });
    await ChatThread.updateOne({ userId, "messages.changeId": changeId }, { $set: { "messages.$.undone": true } });
    res.json({ success: true, undone: result.undone, message: result.message });
  } catch (error) {
    console.error("Undo error:", error);
    res.status(500).json({ success: false, message: "Unable to undo that right now" });
  }
};
