const SkillAssociation = require("../models/SkillAssociation");
const { TEXT_LIMITS } = require("../utils/limits");
const mongoose = require("mongoose");
const Education = require("../models/Education");
const { deleteFile } = require("../storage/fileStorage");

const editableFields = [
  "institution",
  "degree",
  "fieldOfStudy",
  "location",
  "startMonth",
  "startYear",
  "endMonth",
  "endYear",
  "currentlyStudying",
  "grade",
  "description"
];

function pickFields(body = {}) {
  const result = {};

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function validateEducation(data) {
  for (const [field, maxLength] of [
    ["institution", 200],
    ["degree", 150]
  ]) {
    if (
      typeof data[field] !== "string" ||
      !data[field].trim() ||
      data[field].length > maxLength
    ) {
      return `${field} is required (maximum ${maxLength} characters)`;
    }
  }

  for (const [field, maxLength] of [
    ["fieldOfStudy", 150],
    ["location", 200],
    ["grade", 50],
    ["description", TEXT_LIMITS.summary]
  ]) {
    if (
      typeof data[field] !== "string" ||
      data[field].length > maxLength
    ) {
      return field === "description"
        ? `Description can be up to ${maxLength} characters`
        : `Invalid ${field}`;
    }
  }

  if (typeof data.currentlyStudying !== "boolean") {
    return "Invalid currentlyStudying value";
  }

  for (const field of ["startMonth", "endMonth"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) ||
        data[field] < 1 ||
        data[field] > 12)
    ) {
      return `Invalid ${field}`;
    }
  }

  for (const field of ["startYear", "endYear"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) ||
        data[field] < 1900 ||
        data[field] > 2100)
    ) {
      return `Invalid ${field}`;
    }
  }

  if (data.startMonth !== null && data.startYear === null) {
    return "Start year is required when start month is set";
  }

  if (data.endMonth !== null && data.endYear === null) {
    return "End year is required when end month is set";
  }

  if (data.currentlyStudying) {
    if (data.endMonth !== null || data.endYear !== null) {
      return "Current education cannot have an end date";
    }
  }

  if (
    data.startYear !== null &&
    data.endYear !== null
  ) {
    const start = data.startYear * 12 + (data.startMonth || 1);
    const end = data.endYear * 12 + (data.endMonth || 12);

    if (end < start) {
      return "End date cannot be earlier than start date";
    }
  }

  return null;
}

function normalize(data) {
  const result = { ...data };

  for (const field of [
    "institution",
    "degree",
    "fieldOfStudy",
    "location",
    "grade",
    "description"
  ]) {
    result[field] = result[field].trim();
  }

  if (result.currentlyStudying) {
    result.endMonth = null;
    result.endYear = null;
  }

  return result;
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("Education error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process education"
  });
}

// Loads the logged-in user's education from req.params.educationId.
// Sends a 400/404 and returns null when it is missing.
async function findOwnedEducation(req, res) {
  if (!mongoose.isValidObjectId(req.params.educationId)) {
    res.status(400).json({
      success: false,
      message: "Invalid education ID"
    });
    return null;
  }

  const education = await Education.findOne({
    _id: req.params.educationId,
    userId: req.session.userId
  });

  if (!education) {
    res.status(404).json({
      success: false,
      message: "Education not found"
    });
    return null;
  }

  return education;
}

exports.getEducations = async (req, res) => {
  try {
    const educations = await Education.find({
      userId: req.session.userId
    }).sort({
      currentlyStudying: -1,
      endYear: -1,
      endMonth: -1,
      startYear: -1,
      createdAt: -1
    });

    return res.json({
      success: true,
      educations
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getEducation = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    return res.json({
      success: true,
      education
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createEducation = async (req, res) => {
  try {
    const data = {
      institution: "",
      degree: "",
      fieldOfStudy: "",
      location: "",
      startMonth: null,
      startYear: null,
      endMonth: null,
      endYear: null,
      currentlyStudying: false,
      grade: "",
      description: "",
      ...pickFields(req.body || {})
    };

    // Clear end date before validating a current education.
    if (data.currentlyStudying === true) {
      data.endMonth = null;
      data.endYear = null;
    }

    const error = validateEducation(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const education = await Education.create({
      ...normalize(data),
      userId: req.session.userId
    });

    return res.status(201).json({
      success: true,
      education
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateEducation = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const data = {
      ...pickFields(education.toObject()),
      ...pickFields(req.body || {})
    };

    if (data.currentlyStudying === true) {
      data.endMonth = null;
      data.endYear = null;
    }

    const error = validateEducation(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    Object.assign(education, normalize(data));
    await education.save();

    return res.json({
      success: true,
      education
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteEducation = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const fileKeys = [
      ...education.media,
      ...education.achievements,
      ...education.certifications,
      ...education.volunteering,
      ...education.projects.flatMap((project) => project.media)
    ].map((item) => item.file?.key);

    await education.deleteOne();
    await SkillAssociation.removeForParent(
      req.session.userId,
      "education",
      education
    );

    for (const key of fileKeys) {
      await deleteFile(key);
    }

    return res.json({
      success: true,
      message: "Education deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.findOwnedEducation = findOwnedEducation;
