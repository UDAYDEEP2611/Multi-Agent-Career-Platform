const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// The buffer zone: entries the data entry agent prepared from chat, waiting
// for the user to check them on the section's page. Confirming one creates
// the real record through the section's controller; until then nothing in
// the portfolio changes.
const draftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // "education", "experience"... (see services/agents/sectionSpecs.js)
    section: { type: String, required: true, trim: true, maxlength: 40 },

    // The record's fields, as the section's controller expects them
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // What the user wrote, for reference
    sourceText: { type: String, trim: true, maxlength: 4000, default: "" },

    // Things to look at before confirming ("You already have…")
    notes: { type: [String], default: [] },

    // The last time confirming failed, the controller's reason
    error: { type: String, trim: true, maxlength: 500, default: "" }
  },
  {
    timestamps: true,
    collection: "drafts"
  }
);

module.exports = userModel("Draft", draftSchema);
