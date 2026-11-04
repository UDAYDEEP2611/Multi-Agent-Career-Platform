const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// The short summary under the name in each portfolio design's hero, one per
// design, written by the hero summary agent or by the user.
const heroSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    items: {
      type: [
        new mongoose.Schema(
          {
            designId: { type: String, required: true, trim: true, maxlength: 40 },
            text: { type: String, required: true, trim: true, maxlength: 400 },
            // "AI · mistral" or "Edited by you"
            origin: { type: String, trim: true, maxlength: 60, default: "" },
            // Fingerprint of the summary and headline it was written from,
            // so the page can say when they've changed since
            sourceKey: { type: String, maxlength: 64, default: "" },
            updatedAt: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true,
    collection: "hero_summaries"
  }
);

module.exports = userModel("HeroSummary", heroSummarySchema);
