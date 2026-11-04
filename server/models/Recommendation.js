const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

// Recommendations (a written endorsement) and references (someone who can
// be contacted). Optionally tied to the Experience or Education where you
// worked or studied together.

const KINDS = ["Recommendation", "Reference"];
const CONTEXT_TYPES = ["experience", "education"];

const text = (maxlength) => ({ type: String, trim: true, maxlength, default: "" });

const recommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    kind: { type: String, enum: KINDS, default: "Recommendation" },

    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: text(100),
    relationship: { type: String, required: true, trim: true, maxlength: 100 },
    recommenderTitle: text(150),
    recommenderOrganization: text(150),

    contextType: { type: String, enum: [...CONTEXT_TYPES, null], default: null },
    contextId: { type: mongoose.Schema.Types.ObjectId, default: null },

    text: text(3000),

    month: { type: Number, min: 1, max: 12, default: null },
    year: { type: Number, min: 1900, max: 2100, default: null },

    profileUrl: text(2048),
    email: text(254),
    phone: text(30),

    featured: { type: Boolean, default: false },
    visibility: { type: String, enum: ["Public", "Private"], default: "Public" }
  },
  {
    timestamps: true,
    collection: "recommendations"
  }
);

// Show in portfolio / show in resume
recommendationSchema.plugin(visibilityPlugin);

module.exports = userModel("Recommendation", recommendationSchema);
module.exports.KINDS = KINDS;
module.exports.CONTEXT_TYPES = CONTEXT_TYPES;
