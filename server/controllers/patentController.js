const mongoose = require("mongoose");
const Patent = require("../models/Patent");
const { STATUSES } = require("../models/Patent");
const validUrl = require("../utils/validUrl");
const { validPastDate, cleanNames } = require("../utils/calendarDate");

const MAX_PATENTS = 50;
const MAX_CO_INVENTORS = 20;

const editableFields = ["title", "patentNumber", "status", "date", "coInventors", "url", "description"];

const defaults = {
  title: "",
  patentNumber: "",
  status: "Issued",
  date: null,
  coInventors: [],
  url: "",
  description: ""
};

const textLimits = {
  title: ["Patent title", 255],
  patentNumber: ["Patent or application number", 60],
  url: ["Patent URL", 2048],
  description: ["Description", 2000]
};

// Merges the request onto the existing patent (PATCH) or the defaults
// (POST) and validates the result. Returns { data } or { error }.
function validatePatent(body, existing = null) {
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

  if (!data.title) return { error: "Patent title is required" };
  if (!data.patentNumber) return { error: "Patent or application number is required" };

  if (!STATUSES.includes(data.status)) {
    return { error: "Status must be Issued or Pending" };
  }

  if (data.date === "") data.date = null;

  if (data.date !== null && !validPastDate(data.date)) {
    return { error: "Date must be a real date that isn't in the future" };
  }

  if (data.url && !validUrl(data.url)) {
    return { error: "Patent URL must start with http:// or https://" };
  }

  const inventors = cleanNames(data.coInventors, { max: MAX_CO_INVENTORS, label: "inventor" });
  if (inventors.error) return { error: inventors.error };
  data.coInventors = inventors.names;

  return { data };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Patent error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process patent"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.patentId)) {
    res.status(400).json({ success: false, message: "Invalid patent ID" });
    return null;
  }

  const patent = await Patent.findOne({
    _id: req.params.patentId,
    userId: req.session.userId
  });

  if (!patent) {
    res.status(404).json({ success: false, message: "Patent not found" });
    return null;
  }

  return patent;
}

// Newest date first; undated ones last, newest added first
const newestFirst = (a, b) =>
  (b.date || "").localeCompare(a.date || "") ||
  b.createdAt - a.createdAt;

// GET /api/patents
exports.getPatents = async (req, res) => {
  try {
    const patents = await Patent.find({ userId: req.session.userId });

    return res.json({
      success: true,
      max: MAX_PATENTS,
      patents: patents.sort(newestFirst)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/patents
exports.createPatent = async (req, res) => {
  try {
    const userId = req.session.userId;

    if ((await Patent.countDocuments({ userId })) >= MAX_PATENTS) {
      return res.status(400).json({
        success: false,
        message: `You can add up to ${MAX_PATENTS} patents`
      });
    }

    const result = validatePatent(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const patent = await Patent.create({ ...result.data, userId });

    return res.status(201).json({ success: true, patent });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/patents/:patentId
exports.updatePatent = async (req, res) => {
  try {
    const patent = await findOwned(req, res);
    if (!patent) return;

    const result = validatePatent(req.body || {}, patent);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    patent.set(result.data);
    await patent.save();

    return res.json({ success: true, patent });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/patents/:patentId
exports.deletePatent = async (req, res) => {
  try {
    const patent = await findOwned(req, res);
    if (!patent) return;

    await patent.deleteOne();

    return res.json({ success: true, message: "Patent deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
