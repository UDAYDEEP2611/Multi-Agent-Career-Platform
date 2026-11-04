const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");
const { projectMediaSchema } = require("./subdocumentSchemas");

// Activity & Achievements: awards, honors, hackathons, talks and other
// activities. Separate from the achievements stored inside an Experience,
// Education or project. Optionally associated with one Experience or
// Education. Media is stored inside the achievement.

const CATEGORIES = [
  "Award",
  "Honor",
  "Scholarship",
  "Hackathon",
  "Competition",
  "Talk / Presentation",
  "Leadership",
  "Club / Society",
  "Event",
  "Other"
];

const CONTEXT_TYPES = ["experience", "education"];

const text = (maxlength) => ({ type: String, trim: true, maxlength, default: "" });

const achievementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: CATEGORIES, required: true },
    issuer: text(200),
    result: text(100),

    contextType: { type: String, enum: [...CONTEXT_TYPES, null], default: null },
    contextId: { type: mongoose.Schema.Types.ObjectId, default: null },

    month: { type: Number, min: 1, max: 12, default: null },
    year: { type: Number, min: 1900, max: 2100, default: null },

    description: text(2000),
    url: text(2048),
    featured: { type: Boolean, default: false },

    media: { type: [projectMediaSchema], default: [] }
  },
  {
    timestamps: true,
    collection: "activity_achievements"
  }
);

// Show in portfolio / show in resume
achievementSchema.plugin(visibilityPlugin);

module.exports = userModel("Achievement", achievementSchema);
module.exports.CATEGORIES = CATEGORIES;
