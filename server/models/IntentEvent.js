const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// Every routing decision the assistant's supervisor makes, and the user's
// correction when it picked the wrong agent. Corrections become training
// data for that user's intent model; the rest feed the model metrics
// (correction rate, average confidence) used to watch for drift.
const intentEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // The assistant message the decision produced
    messageId: { type: String, trim: true, maxlength: 40, default: "" },
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    predicted: { type: String, trim: true, maxlength: 20, default: "" },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    // How it was decided: "ensemble", "language model", "asked", "pending"…
    decidedBy: { type: String, trim: true, maxlength: 40, default: "" },
    modelVersion: { type: String, trim: true, maxlength: 20, default: "" },
    // Set when the user says it should have been another agent
    correctedTo: { type: String, trim: true, maxlength: 20, default: "" }
  },
  { timestamps: true, collection: "intent_events" }
);

intentEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = userModel("IntentEvent", intentEventSchema);
