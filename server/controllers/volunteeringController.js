const mongoose = require("mongoose");
const Volunteering = require("../models/Volunteering");
const { CAUSES } = require("../models/Volunteering");
const { deleteFile } = require("../storage/fileStorage");

const editableFields = [
  "organization",
  "role",
  "cause",
  "currentlyVolunteering",
  "startMonth",
  "startYear",
  "endMonth",
  "endYear",
  "description"
];

const defaults = {
  organization: "",
  role: "",
  cause: "",
  currentlyVolunteering: false,
  startMonth: null,
  startYear: null,
  endMonth: null,
  endYear: null,
  description: ""
};

const textLimits = {
  organization: ["Organization", 200],
  role: ["Role", 200],
  description: ["Description", 2000]
};

const toMonth = (year, month, fallback) => year * 12 + (month || fallback);

// Merges the request onto the existing role (PATCH) or the defaults (POST)
// and validates the result. Returns { data } or { error }.
function validateVolunteering(body, existing = null) {
  for (const key of Object.keys(body)) {
    if (!editableFields.includes(key)) {
      return { error: `Unsupported field: ${key}` };
    }
  }

  const base = existing ? existing.toObject() : defaults;
  const data = {};

  for (const field of editableFields) {
    data[field] = body[field] !== undefined ? body[field] : base[field];
  }

  for (const [field, [label, max]] of Object.entries(textLimits)) {
    if (typeof data[field] !== "string" || data[field].trim().length > max) {
      return { error: `${label} must be at most ${max} characters` };
    }

    data[field] = data[field].trim();
  }

  if (!data.organization) return { error: "Organization is required" };
  if (!data.role) return { error: "Role is required" };

  if (data.cause !== "" && !CAUSES.includes(data.cause)) {
    return { error: "Invalid cause" };
  }

  if (typeof data.currentlyVolunteering !== "boolean") {
    return { error: "currentlyVolunteering must be true or false" };
  }

  for (const field of ["startMonth", "endMonth"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] < 1 || data[field] > 12)
    ) {
      return { error: `Invalid ${field}` };
    }
  }

  for (const field of ["startYear", "endYear"]) {
    if (
      data[field] !== null &&
      (!Number.isInteger(data[field]) || data[field] < 1900 || data[field] > 2100)
    ) {
      return { error: `Invalid ${field}` };
    }
  }

  if (data.startMonth !== null && data.startYear === null) {
    return { error: "Start year is required when start month is selected" };
  }

  // Current roles have no end date
  if (data.currentlyVolunteering) {
    data.endMonth = null;
    data.endYear = null;
  } else if (data.endMonth !== null && data.endYear === null) {
    return { error: "End year is required when end month is selected" };
  }

  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;

  for (const [label, year, month] of [
    ["Start", data.startYear, data.startMonth],
    ["End", data.endYear, data.endMonth]
  ]) {
    if (year !== null && toMonth(year, month, 1) > currentMonth) {
      return { error: `${label} date can't be in the future` };
    }
  }

  if (
    data.startYear !== null &&
    data.endYear !== null &&
    toMonth(data.endYear, data.endMonth, 12) < toMonth(data.startYear, data.startMonth, 1)
  ) {
    return { error: "End date cannot be earlier than start date" };
  }

  return { data };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Volunteering error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process volunteering"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.volunteeringId)) {
    res.status(400).json({ success: false, message: "Invalid volunteering ID" });
    return null;
  }

  const item = await Volunteering.findOne({
    _id: req.params.volunteeringId,
    userId: req.session.userId
  });

  if (!item) {
    res.status(404).json({ success: false, message: "Volunteering not found" });
    return null;
  }

  return item;
}

const endMonths = (item) =>
  item.currentlyVolunteering
    ? Infinity
    : item.endYear
      ? toMonth(item.endYear, item.endMonth, 12)
      : 0;

const startMonths = (item) =>
  item.startYear ? toMonth(item.startYear, item.startMonth, 1) : 0;

// Current roles first, then most recently ended, then newest start
const newestFirst = (a, b) =>
  endMonths(b) - endMonths(a) ||
  startMonths(b) - startMonths(a) ||
  b.createdAt - a.createdAt;

// GET /api/volunteering
exports.getVolunteering = async (req, res) => {
  try {
    const items = await Volunteering.find({ userId: req.session.userId });

    return res.json({ success: true, volunteering: items.sort(newestFirst) });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/volunteering/:volunteeringId
exports.getVolunteeringRole = async (req, res) => {
  try {
    const volunteering = await findOwned(req, res);
    if (!volunteering) return;

    return res.json({ success: true, volunteering });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/volunteering
exports.createVolunteering = async (req, res) => {
  try {
    const result = validateVolunteering(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const volunteering = await Volunteering.create({
      ...result.data,
      userId: req.session.userId
    });

    return res.status(201).json({ success: true, volunteering });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/volunteering/:volunteeringId
exports.updateVolunteering = async (req, res) => {
  try {
    const volunteering = await findOwned(req, res);
    if (!volunteering) return;

    const result = validateVolunteering(req.body || {}, volunteering);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    volunteering.set(result.data);
    await volunteering.save();

    return res.json({ success: true, volunteering });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/volunteering/:volunteeringId
// Removes the role and its uploaded files
exports.deleteVolunteering = async (req, res) => {
  try {
    const volunteering = await findOwned(req, res);
    if (!volunteering) return;

    const fileKeys = volunteering.media.map((item) => item.file?.key);

    await volunteering.deleteOne();

    for (const key of fileKeys) {
      await deleteFile(key);
    }

    return res.json({ success: true, message: "Volunteering deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
