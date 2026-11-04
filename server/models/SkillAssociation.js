const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

const SOURCE_TYPES = [
  "experience",
  "education",
  "experience_project",
  "education_project",
  "project",
  "certification"
];

// Links one master skill (user_skills) to an Experience, an Education, or
// a project inside either, a standalone project or a certification. Experience and
// Education projects are stored inside their parent, so for those sourceId
// is the project's subdocument ID.
const skillAssociationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true
    },

    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSkill",
      required: true,
      immutable: true
    },

    sourceType: {
      type: String,
      required: true,
      immutable: true,
      enum: SOURCE_TYPES
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true
    }
  },
  {
    timestamps: true,
    collection: "skill_associations"
  }
);

skillAssociationSchema.index(
  { userId: 1, skillId: 1, sourceType: 1, sourceId: 1 },
  { unique: true }
);

skillAssociationSchema.index({ userId: 1, sourceType: 1, sourceId: 1 });

// Removes the links to a deleted parent record and its projects
skillAssociationSchema.statics.removeForParent = function (
  userId,
  parentType,
  parent
) {
  return this.deleteMany({
    userId,
    $or: [
      { sourceType: parentType, sourceId: parent._id },
      {
        sourceType: `${parentType}_project`,
        sourceId: { $in: parent.projects.map((project) => project._id) }
      }
    ]
  });
};

const SkillAssociation = userModel(
  "SkillAssociation",
  skillAssociationSchema
);

module.exports = SkillAssociation;
module.exports.SOURCE_TYPES = SOURCE_TYPES;
