const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

// Papers, articles, books and posts. The user is always an author;
// coAuthors lists the others in order.

const publicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    title: { type: String, required: true, trim: true, maxlength: 255 },
    publisher: { type: String, trim: true, maxlength: 255, default: "" },
    // "YYYY-MM-DD" (a calendar date, so no time zone shifts), or null
    publishedOn: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
    coAuthors: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      default: []
    },
    url: { type: String, trim: true, maxlength: 2048, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" }
  },
  {
    timestamps: true,
    collection: "publications"
  }
);

// Show in portfolio / show in resume
publicationSchema.plugin(visibilityPlugin);

module.exports = userModel("Publication", publicationSchema);
