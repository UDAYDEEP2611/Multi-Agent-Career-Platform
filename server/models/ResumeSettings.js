const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

const { RESUME_LIMIT_DEFAULTS, RESUME_EXTRAS, RESUME_SKILL_STYLES, ...options } = require("./resumeSettingsOptions");

// What the designed resumes include, for every resume design (the choices
// and defaults are in resumeSettingsOptions.js). The user changes it by asking
// the assistant ("show all my projects on my resume", "2 jobs on my resume").
const resumeSettingsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // How many items each section shows; 0 means all of them
    limits: {
      experience: { type: Number, min: 0, max: 50, default: RESUME_LIMIT_DEFAULTS.experience },
      education: { type: Number, min: 0, max: 50, default: RESUME_LIMIT_DEFAULTS.education },
      projects: { type: Number, min: 0, max: 50, default: RESUME_LIMIT_DEFAULTS.projects },
      certifications: { type: Number, min: 0, max: 50, default: RESUME_LIMIT_DEFAULTS.certifications }
    },

    // Optional sections the user asked to include
    extras: { type: [{ type: String, enum: RESUME_EXTRAS }], default: [] },

    // Every skill instead of the key ones (up to 15)
    allSkills: { type: Boolean, default: false },

    // The column a section was asked to sit in, by section id
    columns: { type: Map, of: String, default: {} },

    // Wording changed for resumes only; the portfolio keeps the original:
    // { replace: [{ from, to }], summary, line, contact: { phone }, titles: { experience } }
    rewrites: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // The order sections were asked to sit in, by section id
    order: { type: [String], default: [] },

    // One detail left off one entry ("education:<id>:grade"), or the page
    // ("contact:phone", "page:summary")
    hiddenFields: { type: [String], default: [] },

    // How skills are drawn, when not the design's own way
    skillStyle: { type: String, enum: ["", ...RESUME_SKILL_STYLES], default: "" },

    // Sizes changed from the design's own: sideShift (sidebar width, % of the
    // page) and margin, gutter, text, spacing (% change)
    tweaks: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // One resume design's own changes over the settings above, by design id
    // (made in that resume's AI chat): limits, optional sections, skills,
    // columns, details, skill style, entries left off this resume ("projects:<id>") and its colour
    designs: { type: Map, of: new mongoose.Schema({
      limits: { type: Map, of: Number, default: undefined },
      extras: { type: [{ type: String, enum: RESUME_EXTRAS }], default: undefined },
      allSkills: { type: Boolean, default: undefined },
      columns: { type: Map, of: String, default: undefined },
      hiddenFields: { type: [String], default: undefined },
      order: { type: [String], default: undefined },
      rewrites: { type: mongoose.Schema.Types.Mixed, default: undefined },
      tweaks: { type: mongoose.Schema.Types.Mixed, default: undefined },
      skillStyle: { type: String, enum: ["", ...RESUME_SKILL_STYLES], default: undefined },
      hiddenEntries: { type: [String], default: [] },
      accent: { type: String, default: "", match: /^(#[0-9a-fA-F]{6})?$/ }
    }, { _id: false }), default: {} }
  },
  { timestamps: true, collection: "resume_settings" }
);

module.exports = userModel("ResumeSettings", resumeSettingsSchema);
module.exports.RESUME_LIMIT_DEFAULTS = RESUME_LIMIT_DEFAULTS;
module.exports.RESUME_EXTRAS = RESUME_EXTRAS;
module.exports.RESUME_COLUMN_SECTIONS = options.RESUME_COLUMN_SECTIONS;
module.exports.RESUME_COLUMN_PLACES = options.RESUME_COLUMN_PLACES;
module.exports.RESUME_SKILL_STYLES = RESUME_SKILL_STYLES;
