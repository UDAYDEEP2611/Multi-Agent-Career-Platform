const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

// Patents and patent applications. The user is always an inventor;
// coInventors lists the others in order.

const STATUSES = ["Issued", "Pending"];

const patentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    title: { type: String, required: true, trim: true, maxlength: 255 },
    patentNumber: { type: String, required: true, trim: true, maxlength: 60 },
    status: { type: String, enum: STATUSES, default: "Issued" },
    // Issue date when issued, filing date when pending: "YYYY-MM-DD" or null
    date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: null },
    coInventors: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      default: []
    },
    url: { type: String, trim: true, maxlength: 2048, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" }
  },
  {
    timestamps: true,
    collection: "patents"
  }
);

// Show in portfolio / show in resume
patentSchema.plugin(visibilityPlugin);

module.exports = userModel("Patent", patentSchema);
module.exports.STATUSES = STATUSES;
