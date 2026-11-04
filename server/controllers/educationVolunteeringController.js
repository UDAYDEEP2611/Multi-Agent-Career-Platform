const { rejectIfFull } = require("../utils/limits");
const mongoose = require("mongoose");
const { findOwnedEducation } = require("./educationController");
const { deleteFile } = require("../storage/fileStorage");

// Volunteering records are stored in education.volunteering, so each one
// is always scoped to its user and education.
const FIELDS = [
  "organization",
  "role",
  "cause",
  "location",
  "startMonth",
  "startYear",
  "endMonth",
  "endYear",
  "currentlyVolunteering",
  "description",
  "url"
];

const defaults = {
  organization: "",
  role: "",
  cause: "",
  location: "",
  startMonth: null,
  startYear: null,
  endMonth: null,
  endYear: null,
  currentlyVolunteering: false,
  description: "",
  url: ""
};

function pickFields(body = {}) {
  const result = {};

  for (const field of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
}

function findVolunteering(education, req, res) {
  if (!mongoose.isValidObjectId(req.params.volunteeringId)) {
    res.status(400).json({
      success: false,
      message: "Invalid volunteering ID"
    });
    return null;
  }

  const volunteering = education.volunteering.id(req.params.volunteeringId);

  if (!volunteering) {
    res.status(404).json({
      success: false,
      message: "Volunteering record not found"
    });
    return null;
  }

  return volunteering;
}

function validate(data) {
  for (const [field, max] of [
    ["organization", 200],
    ["role", 150]
  ]) {
    if (
      typeof data[field] !== "string" ||
      !data[field].trim() ||
      data[field].length > max
    ) {
      return `${field} is required (maximum ${max} characters)`;
    }
  }

  for (const [field, max] of [
    ["cause", 150],
    ["location", 200],
    ["description", 5000],
    ["url", 2048]
  ]) {
    if (
      typeof data[field] !== "string" ||
      data[field].length > max
    ) {
      return `Invalid ${field}`;
    }
  }

  if (typeof data.currentlyVolunteering !== "boolean") {
    return "Invalid currentlyVolunteering value";
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

  if (
    data.currentlyVolunteering &&
    (data.endMonth !== null || data.endYear !== null)
  ) {
    return "Ongoing volunteering cannot have an end date";
  }

  if (data.startYear !== null && data.endYear !== null) {
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

      if (url.username || url.password) {
        return "URL cannot contain credentials";
      }
    } catch {
      return "Enter a valid link starting with http:// or https://";
    }
  }

  return null;
}

function normalize(data) {
  const result = { ...data };

  for (const field of [
    "organization",
    "role",
    "cause",
    "location",
    "description",
    "url"
  ]) {
    result[field] = result[field].trim();
  }

  if (result.currentlyVolunteering) {
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

  console.error("Education Volunteering error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process volunteering"
  });
}

// Months count as 0 when missing, so "2024" sorts before "2024-03"
const toMonths = (year, month) => (year || 0) * 12 + (month || 0);

// Ongoing first, then latest end date, then latest start date
function newestFirst(a, b) {
  if (a.currentlyVolunteering !== b.currentlyVolunteering) {
    return a.currentlyVolunteering ? -1 : 1;
  }

  return (
    toMonths(b.endYear, b.endMonth) - toMonths(a.endYear, a.endMonth) ||
    toMonths(b.startYear, b.startMonth) - toMonths(a.startYear, a.startMonth) ||
    b.createdAt - a.createdAt
  );
}

exports.getVolunteering = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    return res.json({
      success: true,
      volunteering: [...education.volunteering].sort(newestFirst)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createVolunteering = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    if (rejectIfFull(res, education, "volunteering", "volunteering entries")) return;

    const data = {
      ...defaults,
      ...pickFields(req.body || {})
    };

    if (data.currentlyVolunteering === true) {
      data.endMonth = null;
      data.endYear = null;
    }

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    education.volunteering.push(normalize(data));
    await education.save();

    return res.status(201).json({
      success: true,
      volunteering: education.volunteering[education.volunteering.length - 1]
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateVolunteering = async (req, res) => {
  try {
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const volunteering = findVolunteering(education, req, res);
    if (!volunteering) return;

    const data = {
      ...pickFields(volunteering.toObject()),
      ...pickFields(req.body || {})
    };

    if (data.currentlyVolunteering === true) {
      data.endMonth = null;
      data.endYear = null;
    }

    const error = validate(data);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    volunteering.set(normalize(data));
    await education.save();

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
    const education = await findOwnedEducation(req, res);
    if (!education) return;

    const volunteering = findVolunteering(education, req, res);
    if (!volunteering) return;

    const fileKey = volunteering.file?.key;

    volunteering.deleteOne();
    await education.save();
    await deleteFile(fileKey);

    return res.json({
      success: true,
      message: "Volunteering deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
