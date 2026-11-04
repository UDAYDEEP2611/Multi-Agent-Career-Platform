const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");
const { projectMediaSchema } = require("./subdocumentSchemas");

// Standalone volunteering roles (separate from the volunteering stored
// inside an Experience or Education). Media is stored inside the role.

const CAUSES = [
  "Animal Welfare",
  "Arts and Culture",
  "Children",
  "Civil Rights and Social Action",
  "Disaster and Humanitarian Relief",
  "Economic Empowerment",
  "Education",
  "Environment",
  "Health",
  "Human Rights",
  "Politics",
  "Poverty Alleviation",
  "Science and Technology",
  "Social Services",
  "Veteran Support"
];

const monthField = { type: Number, min: 1, max: 12, default: null };
const yearField = { type: Number, min: 1900, max: 2100, default: null };

const volunteeringSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    organization: { type: String, required: true, trim: true, maxlength: 200 },
    role: { type: String, required: true, trim: true, maxlength: 200 },
    // One of CAUSES, or "" when not chosen
    cause: { type: String, enum: ["", ...CAUSES], default: "" },

    currentlyVolunteering: { type: Boolean, default: false },
    startMonth: monthField,
    startYear: yearField,
    endMonth: monthField,
    endYear: yearField,

    description: { type: String, trim: true, maxlength: 2000, default: "" },

    media: { type: [projectMediaSchema], default: [] }
  },
  {
    timestamps: true,
    collection: "volunteering"
  }
);

// Show in portfolio / show in resume
volunteeringSchema.plugin(visibilityPlugin);

module.exports = userModel("Volunteering", volunteeringSchema);
module.exports.CAUSES = CAUSES;
