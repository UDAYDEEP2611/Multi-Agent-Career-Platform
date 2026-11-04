const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

const {
  fileSchema,
  taskSchema,
  skillSchema,
  mediaSchema,
  achievementSchema,
  volunteeringSchema,
  recordSchema,
  contributorSchema,
  projectMediaSchema,
  projectSchema
} = require("./subdocumentSchemas");

const experienceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    jobTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    organization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    location: {
      type: String,
      trim: true,
      default: ""
    },

    locationType: {
      type: String,
      enum: ["", "On-site", "Hybrid", "Remote"],
      default: ""
    },

    employmentType: {
      type: String,
      enum: [
        "", "Full-time", "Part-time",
        "Self-employed", "Freelance",
        "Contract", "Internship",
        "Apprenticeship", "Seasonal"
      ],
      default: ""
    },

    jobSource: {
      type: String,
      enum: [
        "", "LinkedIn", "Company website",
        "Indeed", "Other job sites",
        "Referral", "Contacted by recruiter",
        "Staffing agency", "Other"
      ],
      default: ""
    },

    currentlyWorking: {
      type: Boolean,
      default: false
    },

    startMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },

    startYear: {
      type: Number,
      required: true,
      min: 1900,
      max: 2100
    },

    endMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },

    endYear: {
      type: Number,
      min: 1900,
      max: 2100,
      default: null
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 2200,
      default: ""
    },

    highlights: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    tasks: {
      type: [taskSchema],
      default: []
    },

    skills: {
      type: [skillSchema],
      default: []
    },

    media: {
      type: [mediaSchema],
      default: []
    },

    achievements: {
      type: [achievementSchema],
      default: []
    },

    volunteering: {
      type: [volunteeringSchema],
      default: []
    },

    records: {
      type: [recordSchema],
      default: []
    },

    projects: {
      type: [projectSchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: "experiences"
  }
);

experienceSchema.index({ userId: 1, startYear: -1 });

// Show in portfolio / show in resume
experienceSchema.plugin(visibilityPlugin);

module.exports = userModel("Experience", experienceSchema);
