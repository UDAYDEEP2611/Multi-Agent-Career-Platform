const mongoose = require("mongoose");
const { visibilityPlugin } = require("./plugins/visibility");

// Building blocks shared by Experience, Education and their projects

// Uploaded picture or PDF (see storage/fileStorage.js)
const fileSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    originalName: { type: String, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    order: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },

    proficiency: {
      type: String,
      enum: ["", "Beginner", "Intermediate", "Advanced", "Expert"],
      default: ""
    },

    order: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

const mediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    mediaType: {
      type: String,
      required: true,
      enum: [
        "Image",
        "Document",
        "Presentation",
        "Video",
        "Certificate",
        "Project",
        "GitHub",
        "Website",
        "Article",
        "Other"
      ]
    },

    url: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    file: {
      type: fileSchema,
      default: null
    }
  },
  { timestamps: true }
);

const achievementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    type: {
      type: String,
      required: true,
      enum: [
        "Achievement",
        "Award",
        "Recognition",
        "Milestone",
        "Activity",
        "Other"
      ]
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ""
    },

    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },

    year: {
      type: Number,
      min: 1900,
      max: 2100,
      default: null
    },

    issuedBy: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ""
    },

    url: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },

    file: {
      type: fileSchema,
      default: null
    }
  },
  { timestamps: true }
);

const volunteeringSchema = new mongoose.Schema(
  {
    organization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    cause: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },

    location: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ""
    },

    startMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },

    startYear: {
      type: Number,
      min: 1900,
      max: 2100,
      default: null
    },

    currentlyVolunteering: {
      type: Boolean,
      default: false
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

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: ""
    },

    url: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },

    file: {
      type: fileSchema,
      default: null
    }
  },
  { timestamps: true }
);

const recordSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    recordType: {
      type: String,
      required: true,
      enum: [
        "Performance Review",
        "Employment Verification",
        "Training",
        "Certification",
        "Compliance",
        "Project Documentation",
        "Other"
      ]
    },

    issuedBy: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ""
    },

    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },

    year: {
      type: Number,
      min: 1900,
      max: 2100,
      default: null
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ""
    },

    referenceUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },

    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },

    // A future public portfolio must only return "Portfolio" records
    visibility: {
      type: String,
      enum: ["Private", "Portfolio"],
      default: "Private"
    },

    file: {
      type: fileSchema,
      default: null
    }
  },
  { timestamps: true }
);

// Project-level tasks, contributors, skills and media will be added
// here as arrays, so they stay scoped to this project and experience.
const contributorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    contribution: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: ""
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: ""
    },

    profileUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },

    order: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  { timestamps: true }
);

// A project media item is either an uploaded file or an external link
const projectMediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },

    mediaType: {
      type: String,
      required: true,
      enum: ["File", "Link"]
    },

    url: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: ""
    },

    file: {
      type: fileSchema,
      default: null
    }
  },
  { timestamps: true }
);

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: ""
    },

    startMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null
    },

    startYear: {
      type: Number,
      min: 1900,
      max: 2100,
      default: null
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

    status: {
      type: String,
      enum: ["Planned", "In Progress", "Completed", "On Hold"],
      default: "In Progress"
    },

    tasks: {
      type: [taskSchema],
      default: []
    },

    contributors: {
      type: [contributorSchema],
      default: []
    },

    skills: {
      type: [skillSchema],
      default: []
    },

    media: {
      type: [projectMediaSchema],
      default: []
    }
  },
  { timestamps: true }
);

// Projects inside a job or school: Show in portfolio / Show in resume
projectSchema.plugin(visibilityPlugin);

module.exports = {
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
};
