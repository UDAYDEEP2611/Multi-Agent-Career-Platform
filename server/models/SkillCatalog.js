const mongoose = require("mongoose");
const { SKILL_TYPES, normalizeSkillName } = require("./UserSkill");

// Shared suggestions for the skill autocomplete. Users can still add
// skills that aren't in here.
const skillCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    // unique: true also creates the index used by prefix search
    normalizedName: {
      type: String,
      required: true,
      unique: true
    },

    skillType: {
      type: String,
      enum: SKILL_TYPES,
      default: "technical"
    }
  },
  {
    timestamps: true,
    collection: "skill_catalog"
  }
);

skillCatalogSchema.pre("validate", function () {
  if (typeof this.name === "string") {
    this.normalizedName = normalizeSkillName(this.name);
  }
});

module.exports = mongoose.model("SkillCatalog", skillCatalogSchema);
