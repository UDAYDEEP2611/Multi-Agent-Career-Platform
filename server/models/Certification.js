const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const { visibilityPlugin } = require("./plugins/visibility");
const { projectMediaSchema } = require("./subdocumentSchemas");

// Licenses and certifications. Media is stored inside the certification;
// skills are links to master skills (skill_associations, sourceType
// "certification").

const monthField = { type: Number, min: 1, max: 12, default: null };
const yearField = { type: Number, min: 1900, max: 2100, default: null };

const certificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
      index: true
    },

    name: { type: String, required: true, trim: true, maxlength: 200 },
    issuingOrganization: { type: String, trim: true, maxlength: 200, default: "" },

    issueMonth: monthField,
    issueYear: yearField,
    expirationMonth: monthField,
    expirationYear: yearField,

    credentialId: { type: String, trim: true, maxlength: 80, default: "" },
    credentialUrl: { type: String, trim: true, maxlength: 2048, default: "" },

    media: { type: [projectMediaSchema], default: [] }
  },
  {
    timestamps: true,
    collection: "certifications"
  }
);

// Show in portfolio / show in resume
certificationSchema.plugin(visibilityPlugin);

module.exports = userModel("Certification", certificationSchema);
