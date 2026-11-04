const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

// Personal and professional interests, shown as pills grouped by category

const CATEGORIES = [
  "Technology",
  "Science & Research",
  "Business & Finance",
  "Sports & Fitness",
  "Outdoors & Travel",
  "Arts & Music",
  "Reading & Writing",
  "Food & Cooking",
  "Gaming",
  "Community & Causes",
  "Other"
];

const normalizeInterestName = (name) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const interestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true
    },

    name: { type: String, required: true, trim: true, maxlength: 60 },
    normalizedName: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, default: "Other" },
    description: { type: String, trim: true, maxlength: 300, default: "" }
  },
  {
    timestamps: true,
    collection: "interests"
  }
);

interestSchema.pre("validate", function () {
  if (typeof this.name === "string") {
    this.normalizedName = normalizeInterestName(this.name);
  }
});

interestSchema.index({ userId: 1, normalizedName: 1 }, { unique: true });

// Show in portfolio / show in resume
interestSchema.plugin(visibilityPlugin);

module.exports = userModel("Interest", interestSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.normalizeInterestName = normalizeInterestName;
