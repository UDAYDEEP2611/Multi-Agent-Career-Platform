const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

const SKILL_TYPES = ["technical", "soft"];

// "  React   JS " and "react js" are the same skill
const normalizeSkillName = (name) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const userSkillSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    // Kept in sync with name; backs the per-user unique index
    normalizedName: {
      type: String,
      required: true
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer"
      }
    },

    lastUsedYear: {
      type: Number,
      default: null
    },

    skillType: {
      type: String,
      enum: SKILL_TYPES,
      default: "technical"
    },

    isImportant: {
      type: Boolean,
      default: false
    },

    // Position within its group (Important, Technical or Soft; lower
    // first). null = not placed yet: shown after placed skills, by rating.
    // Marking a skill important places it last in that group.
    sortOrder: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true,
    collection: "user_skills"
  }
);

userSkillSchema.pre("validate", function () {
  if (typeof this.name === "string") {
    this.normalizedName = normalizeSkillName(this.name);
  }
});

userSkillSchema.index(
  { userId: 1, normalizedName: 1 },
  { unique: true }
);

userSkillSchema.index({
  userId: 1,
  isImportant: -1,
  rating: -1,
  lastUsedYear: -1
});

// Show in portfolio / show in resume
userSkillSchema.plugin(visibilityPlugin);

const UserSkill = userModel("UserSkill", userSkillSchema);

module.exports = UserSkill;
module.exports.SKILL_TYPES = SKILL_TYPES;
module.exports.normalizeSkillName = normalizeSkillName;
