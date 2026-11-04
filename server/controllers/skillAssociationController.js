const mongoose = require("mongoose");

const UserSkill = require("../models/UserSkill");
const SkillAssociation = require("../models/SkillAssociation");
const Experience = require("../models/Experience");
const Education = require("../models/Education");
const Project = require("../models/Project");
const Certification = require("../models/Certification");

// Projects live inside their parent, so they're found by "projects._id"
const sourceQueries = {
  experience: (id) => [Experience, { _id: id }],
  education: (id) => [Education, { _id: id }],
  experience_project: (id) => [Experience, { "projects._id": id }],
  education_project: (id) => [Education, { "projects._id": id }],
  project: (id) => [Project, { _id: id }],
  certification: (id) => [Certification, { _id: id }]
};

const validId = (id) => mongoose.isValidObjectId(id);

const validSource = (sourceType, sourceId) =>
  Object.hasOwn(sourceQueries, sourceType) && validId(sourceId);

async function sourceExists(userId, sourceType, sourceId) {
  const [Model, filter] = sourceQueries[sourceType](sourceId);

  return Boolean(await Model.exists({ ...filter, userId }));
}

const ownsSkill = (userId, skillId) =>
  UserSkill.exists({ _id: skillId, userId });

const sendStatus = (res, status, message) =>
  res.status(status).json({ success: false, message });

function handleError(res, error) {
  if (error.code === 11000) {
    return sendStatus(res, 409, "This skill is already linked to that record");
  }

  console.error("Skill association error:", error);

  return sendStatus(res, 500, "Unable to process skill association");
}

// GET /api/skill-associations/skill/:skillId
// Everywhere one master skill is linked
exports.getAssociations = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { skillId } = req.params;

    if (!validId(skillId)) {
      return sendStatus(res, 400, "Invalid skill ID");
    }

    if (!(await ownsSkill(userId, skillId))) {
      return sendStatus(res, 404, "Skill not found");
    }

    const associations = await SkillAssociation.find({ userId, skillId })
      .sort({ createdAt: -1 });

    return res.json({ success: true, associations });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/skill-associations/source/:sourceType/:sourceId
// Master skills linked to one record, with their details
exports.getSourceSkills = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { sourceType, sourceId } = req.params;

    if (!validSource(sourceType, sourceId)) {
      return sendStatus(res, 400, "Invalid source");
    }

    if (!(await sourceExists(userId, sourceType, sourceId))) {
      return sendStatus(res, 404, "Source record not found");
    }

    const associations = await SkillAssociation.find({
      userId,
      sourceType,
      sourceId
    })
      .populate("skillId", "name rating lastUsedYear skillType isImportant")
      .sort({ createdAt: 1 });

    return res.json({
      success: true,
      associations: associations.filter((item) => item.skillId)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/skill-associations  { skillId, sourceType, sourceId }
exports.createAssociation = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { skillId, sourceType, sourceId } = req.body || {};

    if (!validId(skillId) || !validSource(sourceType, sourceId)) {
      return sendStatus(res, 400, "Invalid skill or source");
    }

    if (!(await ownsSkill(userId, skillId))) {
      return sendStatus(res, 404, "Skill not found");
    }

    if (!(await sourceExists(userId, sourceType, sourceId))) {
      return sendStatus(res, 404, "Source record not found");
    }

    const created = await SkillAssociation.create({
      userId,
      skillId,
      sourceType,
      sourceId
    });

    const association = await created.populate(
      "skillId",
      "name rating lastUsedYear skillType isImportant"
    );

    return res.status(201).json({ success: true, association });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/skill-associations/:associationId
// Removes the link only; the master skill stays
exports.deleteAssociation = async (req, res) => {
  try {
    const { associationId } = req.params;

    if (!validId(associationId)) {
      return sendStatus(res, 400, "Invalid association ID");
    }

    const association = await SkillAssociation.findOneAndDelete({
      _id: associationId,
      userId: req.session.userId
    });

    if (!association) {
      return sendStatus(res, 404, "Association not found");
    }

    return res.json({
      success: true,
      message: "Skill association removed"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
