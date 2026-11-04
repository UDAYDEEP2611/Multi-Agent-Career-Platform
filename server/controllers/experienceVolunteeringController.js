const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const { deleteFile } = require("../storage/fileStorage");

// Volunteering records are stored in the Experience document's `volunteering` array.
const editableFields = [
  "organization",
  "role",
  "cause",
  "location",
  "startMonth",
  "startYear",
  "currentlyVolunteering",
  "endMonth",
  "endYear",
  "description",
  "url"
];

function pickFields(body = {}) {
  const data = {};

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }

  return data;
}

function validate(data) {
  for (const field of ["organization", "role"]) {
    if (
      typeof data[field] !== "string" ||
      !data[field].trim() ||
      data[field].length > 200
    ) {
      return `${field} is required (maximum 200 characters)`;
    }
  }

  for (const [field, limit] of [
    ["cause", 100],
    ["location", 200],
    ["description", 5000],
    ["url", 2048]
  ]) {
    if (
      typeof data[field] !== "string" ||
      data[field].length > limit
    ) {
      return `Invalid ${field}`;
    }
  }

  if (typeof data.currentlyVolunteering !== "boolean") {
    return "Invalid currently volunteering value";
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
    return "Start year is required when start month is selected";
  }

  if (data.endMonth !== null && data.endYear === null) {
    return "End year is required when end month is selected";
  }

  if (data.currentlyVolunteering) {
    data.endMonth = null;
    data.endYear = null;
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

  // URL is optional; when given it must be an http(s) link
  if (data.url.trim()) {
    try {
      const url = new URL(data.url.trim());
      if (!["https:", "http:"].includes(url.protocol)) {
        return "Enter a valid link starting with http:// or https://";
      }
    } catch {
      return "Enter a valid link starting with http:// or https://";
    }
  }

  return null;
}

function trimStrings(data) {
  for (const field of ["organization", "role", "cause", "location", "description", "url"]) {
    data[field] = data[field].trim();
  }

  return data;
}

async function findOwnedExperience(req, res) {
  if (!mongoose.isValidObjectId(req.params.experienceId)) {
    res.status(400).json({
      success: false,
      message: "Invalid experience ID"
    });
    return null;
  }

  const experience = await Experience.findOne({
    _id: req.params.experienceId,
    userId: req.session.userId
  });

  if (!experience) {
    res.status(404).json({
      success: false,
      message: "Experience not found"
    });
    return null;
  }

  return experience;
}

function findVolunteering(experience, req, res) {
  if (!mongoose.isValidObjectId(req.params.volunteeringId)) {
    res.status(400).json({
      success: false,
      message: "Invalid volunteering ID"
    });
    return null;
  }

  const volunteering = experience.volunteering.id(req.params.volunteeringId);

  if (!volunteering) {
    res.status(404).json({
      success: false,
      message: "Volunteering record not found"
    });
    return null;
  }

  return volunteering;
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    message: "Unable to process volunteering record"
  });
}

exports.getVolunteering = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const volunteering = [...experience.volunteering].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    return res.json({
      success: true,
      volunteering
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createVolunteering = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    if (rejectIfFull(res, experience, "volunteering", "volunteering entries")) return;

    const data = {
      organization: "",
      role: "",
      cause: "",
      location: "",
      startMonth: null,
      startYear: null,
      currentlyVolunteering: false,
      endMonth: null,
      endYear: null,
      description: "",
      url: "",
      ...pickFields(req.body)
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    experience.volunteering.push(trimStrings(data));
    await experience.save();

    const volunteering =
      experience.volunteering[experience.volunteering.length - 1];

    return res.status(201).json({
      success: true,
      volunteering
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateVolunteering = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const volunteering = findVolunteering(experience, req, res);
    if (!volunteering) return;

    const data = {
      ...pickFields(volunteering.toObject()),
      ...pickFields(req.body)
    };

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    volunteering.set(trimStrings(data));
    await experience.save();

    return res.json({
      success: true,
      volunteering
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.deleteVolunteering = async (req, res) => {
  try {
    const experience = await findOwnedExperience(req, res);
    if (!experience) return;

    const volunteering = findVolunteering(experience, req, res);
    if (!volunteering) return;

    const fileKey = volunteering.file?.key;

    volunteering.deleteOne();
    await experience.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Volunteering record deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
