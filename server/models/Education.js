const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");

const {
  taskSchema,
  skillSchema,
  fileSchema,
  projectSchema
} = require("./subdocumentSchemas");

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    // Course ID / code, e.g. "CS 5590"
    code: {
      type: String,
      trim: true,
      maxlength: 50,
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

// Activities & Achievements and Certifications & Honors share one shape,
// each with its own list of types
const ACHIEVEMENT_TYPES = [
  "Achievement",
  "Activity",
  "Competition",
  "Leadership",
  "Other"
];

const CERTIFICATION_TYPES = [
  "Certification",
  "Honor",
  "Award",
  "Scholarship",
  "Other"
];

const entrySchema = (types, defaultType) =>
  new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
      },

      type: {
        type: String,
        enum: types,
        default: defaultType
      },

      description: {
        type: String,
        trim: true,
        maxlength: 3000,
        default: ""
      },

      date: {
        type: Date,
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

      // Optional attached picture/PDF (see storage/fileStorage.js)
      file: {
        type: fileSchema,
        default: null
      }
    },
    { timestamps: true }
  );

const educationVolunteeringSchema = new mongoose.Schema(
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
      maxlength: 150
    },

    cause: {
      type: String,
      trim: true,
      maxlength: 150,
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

    currentlyVolunteering: {
      type: Boolean,
      default: false
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

const MEDIA_TYPES = [
  "Document",
  "Certificate",
  "Image",
  "Video",
  "Presentation",
  "Transcript",
  "Link",
  "Other"
];

// A media item can have a link, an attached picture/PDF, or both
const educationMediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    mediaType: {
      type: String,
      enum: MEDIA_TYPES,
      default: "Link"
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
      maxlength: 3000,
      default: ""
    },

    file: {
      type: fileSchema,
      default: null
    }
  },
  { timestamps: true }
);

// Child sections are stored as arrays inside the education, the same way
// as on Experience, so they are deleted along with it.
const educationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    institution: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    degree: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    fieldOfStudy: {
      type: String,
      trim: true,
      maxlength: 150,
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

    currentlyStudying: {
      type: Boolean,
      default: false
    },

    grade: {
      type: String,
      trim: true,
      maxlength: 50,
      default: ""
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2200,
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

    courses: {
      type: [courseSchema],
      default: []
    },

    achievements: {
      type: [entrySchema(ACHIEVEMENT_TYPES, "Achievement")],
      default: []
    },

    certifications: {
      type: [entrySchema(CERTIFICATION_TYPES, "Certification")],
      default: []
    },

    volunteering: {
      type: [educationVolunteeringSchema],
      default: []
    },

    media: {
      type: [educationMediaSchema],
      default: []
    },

    // Same project structure as Experience projects (with their own
    // tasks, contributors, skills and media)
    projects: {
      type: [projectSchema],
      default: []
    }
  },
  {
    timestamps: true,
    collection: "educations"
  }
);

educationSchema.index({
  userId: 1,
  startYear: -1,
  createdAt: -1
});

// Show in portfolio / show in resume
educationSchema.plugin(visibilityPlugin);

module.exports = userModel(
  "Education",
  educationSchema
);

module.exports.ACHIEVEMENT_TYPES = ACHIEVEMENT_TYPES;
module.exports.CERTIFICATION_TYPES = CERTIFICATION_TYPES;
module.exports.MEDIA_TYPES = MEDIA_TYPES;
