const { TEXT_LIMITS } = require("../utils/limits");
const Experience = require("../models/Experience");
const { deleteExperienceFiles } = require("./experienceFileController");
const SkillAssociation = require("../models/SkillAssociation");

const allowedFields = [
  "jobTitle",
  "organization",
  "location",
  "locationType",
  "employmentType",
  "jobSource",
  "currentlyWorking",
  "startMonth",
  "startYear",
  "endMonth",
  "endYear",
  "summary",
  "highlights"
];

const enumOptions = {
  locationType: ["", "On-site", "Hybrid", "Remote"],
  employmentType: [
    "", "Full-time", "Part-time", "Self-employed",
    "Freelance", "Contract", "Internship",
    "Apprenticeship", "Seasonal"
  ],
  jobSource: [
    "", "LinkedIn", "Company website", "Indeed",
    "Other job sites", "Referral",
    "Contacted by recruiter", "Staffing agency", "Other"
  ]
};

function validateExperience(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Invalid experience data";
  }

  for (const key of Object.keys(data)) {
    if (!allowedFields.includes(key)) {
      return `Unsupported field: ${key}`;
    }
  }

  for (const key of ["jobTitle", "organization"]) {
    if (typeof data[key] !== "string" || !data[key].trim()) {
      return `${key} is required`;
    }

    if (data[key].length > 200) {
      return `${key} is too long`;
    }
  }

  const stringLimits = {
    location: 500,
    ...TEXT_LIMITS
  };

  for (const [key, limit] of Object.entries(stringLimits)) {
    if (data[key] !== undefined &&
        (typeof data[key] !== "string" || data[key].length > limit)) {
      return key in TEXT_LIMITS
        ? `${key} can be up to ${limit} characters`
        : `Invalid ${key}`;
    }
  }

  for (const [key, options] of Object.entries(enumOptions)) {
    if (data[key] !== undefined && !options.includes(data[key])) {
      return `Invalid ${key}`;
    }
  }

  if (data.currentlyWorking !== undefined &&
      typeof data.currentlyWorking !== "boolean") {
    return "currentlyWorking must be true or false";
  }

  const validYear = (value) =>
    Number.isInteger(value) && value >= 1900 && value <= 2100;

  const validMonth = (value) =>
    value === null ||
    (Number.isInteger(value) && value >= 1 && value <= 12);

  if (!validYear(data.startYear)) {
    return "A valid start year is required";
  }

  if (data.startMonth !== undefined && !validMonth(data.startMonth)) {
    return "Invalid start month";
  }

  if (data.currentlyWorking) {
    if (data.endMonth != null || data.endYear != null) {
      return "Current positions cannot have an end date";
    }
  } else {
    if (!validYear(data.endYear)) {
      return "End year is required for previous positions";
    }

    if (data.endMonth !== undefined && !validMonth(data.endMonth)) {
      return "Invalid end month";
    }

    if (data.endYear < data.startYear) {
      return "End date cannot precede start date";
    }

    if (data.endYear === data.startYear &&
        data.startMonth != null &&
        data.endMonth != null &&
        data.endMonth < data.startMonth) {
      return "End month cannot precede start month";
    }
  }

  return null;
}

function pickFields(body) {
  const result = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function sendError(res, error, message) {
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid experience ID"
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error(message, error);

  return res.status(500).json({
    success: false,
    message
  });
}

// GET all experiences for logged-in user
exports.getExperiences = async (req, res) => {
  try {
    const experiences = await Experience.find({
      userId: req.session.userId
    }).sort({
      currentlyWorking: -1,
      startYear: -1,
      startMonth: -1
    });

    return res.json({
      success: true,
      experiences
    });
  } catch (error) {
    return sendError(res, error, "Unable to load experiences");
  }
};

// GET one experience
exports.getExperience = async (req, res) => {
  try {
    const experience = await Experience.findOne({
      _id: req.params.experienceId,
      userId: req.session.userId
    });

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: "Experience not found"
      });
    }

    return res.json({
      success: true,
      experience
    });
  } catch (error) {
    return sendError(res, error, "Unable to load experience");
  }
};

// POST create experience
exports.createExperience = async (req, res) => {
  try {
    const data = pickFields(req.body || {});

    if (data.currentlyWorking) {
      data.endMonth = null;
      data.endYear = null;
    }

    const error = validateExperience(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const experience = await Experience.create({
      ...data,
      userId: req.session.userId
    });

    return res.status(201).json({
      success: true,
      experience
    });
  } catch (error) {
    return sendError(res, error, "Unable to create experience");
  }
};

// PATCH update experience
exports.updateExperience = async (req, res) => {
  try {
    const experience = await Experience.findOne({
      _id: req.params.experienceId,
      userId: req.session.userId
    });

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: "Experience not found"
      });
    }

    const updates = pickFields(req.body || {});

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No fields provided"
      });
    }

    const merged = {
      ...experience.toObject(),
      ...updates
    };

    if (merged.currentlyWorking) {
      merged.endMonth = null;
      merged.endYear = null;
    }

    const error = validateExperience(
      pickFields(merged)
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    for (const field of allowedFields) {
      if (field in merged) {
        experience.set(field, merged[field]);
      }
    }

    await experience.save();

    return res.json({
      success: true,
      experience
    });
  } catch (error) {
    return sendError(res, error, "Unable to update experience");
  }
};

// DELETE experience (all its sections are stored inside it)
exports.deleteExperience = async (req, res) => {
  try {
    const experience = await Experience.findOneAndDelete({
      _id: req.params.experienceId,
      userId: req.session.userId
    });

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: "Experience not found"
      });
    }

    await SkillAssociation.removeForParent(
      req.session.userId,
      "experience",
      experience
    );
    await deleteExperienceFiles(experience);

    return res.json({
      success: true,
      message: "Experience deleted successfully"
    });
  } catch (error) {
    return sendError(res, error, "Unable to delete experience");
  }
};
