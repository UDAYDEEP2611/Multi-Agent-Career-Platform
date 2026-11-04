const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

const DEFAULT_PROJECT_ROLE = "Creator/Developer";
const {
  taskSchema,
  contributorSchema,
  projectMediaSchema
} = require("./subdocumentSchemas");

// Standalone portfolio projects (personal, research, open source, ...).
// Separate from the projects stored inside an Experience or Education.
// Child sections are stored inside the project, like everywhere else;
// skills are links to master skills (skill_associations, sourceType
// "project").

const PROJECT_TYPES = [
  "Personal",
  "Academic",
  "Professional",
  "Open Source",
  "Research"
];

const PROJECT_STATUSES = ["Planned", "In Progress", "Completed", "On Hold"];

const ACHIEVEMENT_CATEGORIES = [
  "Outcome",
  "Metric",
  "Milestone",
  "Award",
  "Other"
];

const LINK_TYPES = [
  "GitHub",
  "Documentation",
  "Demo",
  "Publication",
  "Article",
  "Video",
  "Other"
];

const projectAchievementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: ACHIEVEMENT_CATEGORIES,
      default: "Outcome"
    },
    // Short result, e.g. "40% faster" or "1,000 users"
    metric: { type: String, trim: true, maxlength: 100, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    month: { type: Number, min: 1, max: 12, default: null },
    year: { type: Number, min: 1900, max: 2100, default: null },
    order: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

const projectLinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    linkType: { type: String, enum: LINK_TYPES, default: "Other" },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    order: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

const urlField = { type: String, trim: true, maxlength: 2048, default: "" };

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    projectType: { type: String, enum: PROJECT_TYPES, default: "Personal" },
    description: { type: String, trim: true, maxlength: 10000, default: "" },
    // Creator/Developer unless the user names another role on the dashboard
    role: { type: String, trim: true, maxlength: 150, default: DEFAULT_PROJECT_ROLE },

    startMonth: { type: Number, min: 1, max: 12, default: null },
    startYear: { type: Number, min: 1900, max: 2100, default: null },
    ongoing: { type: Boolean, default: false },
    endMonth: { type: Number, min: 1, max: 12, default: null },
    endYear: { type: Number, min: 1900, max: 2100, default: null },

    status: { type: String, enum: PROJECT_STATUSES, default: "In Progress" },

    githubUrl: urlField,
    demoUrl: urlField,
    websiteUrl: urlField,

    featured: { type: Boolean, default: false },
    visibility: { type: String, enum: ["Public", "Private"], default: "Public" },

    tasks: { type: [taskSchema], default: [] },
    contributors: { type: [contributorSchema], default: [] },
    media: { type: [projectMediaSchema], default: [] },
    achievements: { type: [projectAchievementSchema], default: [] },
    links: { type: [projectLinkSchema], default: [] }
  },
  {
    timestamps: true,
    collection: "projects"
  }
);

// Show in portfolio / show in resume
projectSchema.plugin(visibilityPlugin);

module.exports = userModel("Project", projectSchema);
module.exports.PROJECT_TYPES = PROJECT_TYPES;
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
module.exports.ACHIEVEMENT_CATEGORIES = ACHIEVEMENT_CATEGORIES;
module.exports.LINK_TYPES = LINK_TYPES;
