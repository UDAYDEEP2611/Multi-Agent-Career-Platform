
const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const {
  ROLE_LIMITS, EMPLOYMENT_TYPES, WORKPLACE_TYPES, SERVICES, INDUSTRIES
} = require("../utils/roleOptions");

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      immutable: true
    },

    contact: {
      firstName: { type: String, trim: true, maxlength: 100 },
      middleName: { type: String, trim: true, maxlength: 100 },
      lastName: { type: String, trim: true, maxlength: 100 },
      preferredName: { type: String, trim: true, maxlength: 100 },
      suffix: { type: String, trim: true, maxlength: 20 },

      email: { type: String, trim: true, lowercase: true },
      phoneType: {
        type: String,
        enum: ["", "Mobile", "Home", "Work", "Other"],
        default: ""
      },
      phoneNumber: { type: String, trim: true },
      alternateMobile: { type: String, trim: true },

      addressLine: { type: String, trim: true },
      country: { type: String, trim: true },
      stateProvince: { type: String, trim: true },
      city: { type: String, trim: true },
      county: { type: String, trim: true },
      postalCode: { type: String, trim: true },

      linkedinUrl: { type: String, trim: true },
      portfolioUrl: { type: String, trim: true },
      githubUrl: { type: String, trim: true }
    },

    personal: {
      dateOfBirth: { type: Date, default: null },

      maritalStatus: {
        type: String,
        enum: [
          "", "Single", "Married", "Divorced",
          "Widowed", "Separated", "Prefer not to say"
        ],
        default: ""
      },

      gender: { type: String, default: "" },
      veteranStatus: { type: Boolean, default: null },
      disabilityStatus: { type: Boolean, default: null },
      ethnicity: { type: String, default: "" },
      authorizedToWork: { type: Boolean, default: null },
      futureSponsorship: { type: Boolean, default: null }
    },

    // What the user is looking for; private to them
    roleDetails: {
      headline: { type: String, trim: true, maxlength: ROLE_LIMITS.maxHeadlineLength, default: "" },
      // The one role resumes and portfolios show
      roleTargeting: { type: String, trim: true, maxlength: ROLE_LIMITS.maxRoleLength, default: "" },
      targetRoles: { type: [String], default: [] },
      employmentTypes: { type: [{ type: String, enum: EMPLOYMENT_TYPES }], default: [] },
      workplaceTypes: { type: [{ type: String, enum: WORKPLACE_TYPES }], default: [] },
      locations: { type: [String], default: [] },
      services: { type: [{ type: String, enum: SERVICES }], default: [] },
      industries: { type: [{ type: String, enum: INDUSTRIES }], default: [] }
    }
  },
  {
    timestamps: true,
    collection: "profiles"
  }
);

module.exports = userModel("Profile", profileSchema);

