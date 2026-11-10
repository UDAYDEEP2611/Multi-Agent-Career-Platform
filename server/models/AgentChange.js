const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// What a change by the agents replaced, so it can be undone. One chat
// message's changes share a batchId; undo reverts the latest batch.
//   kind "resume_settings": before is the settings as they were
//   kind "visibility": before is { section, id, showInPortfolio, showInResume }
//   kind "design": before is { created: id } or the design as it was
const agentChangeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batchId: { type: String, required: true, maxlength: 64, index: true },
    kind: { type: String, enum: ["resume_settings", "visibility", "design"], required: true },
    before: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true, collection: "agent_changes" }
);

module.exports = userModel("AgentChange", agentChangeSchema);
