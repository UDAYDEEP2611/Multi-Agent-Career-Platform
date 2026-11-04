const mongoose = require("mongoose");
const Recommendation = require("../models/Recommendation");
const Experience = require("../models/Experience");
const Education = require("../models/Education");
const { KINDS } = require("../models/Recommendation");
const validUrl = require("../utils/validUrl");

const MAX_RECOMMENDATIONS = 50;

const editableFields = [
  "kind",
  "firstName",
  "lastName",
  "relationship",
  "recommenderTitle",
  "recommenderOrganization",
  "contextType",
  "contextId",
  "text",
  "month",
  "year",
  "profileUrl",
  "email",
  "phone",
  "featured",
  "visibility"
];

const defaults = {
  kind: "Recommendation",
  firstName: "",
  lastName: "",
  relationship: "",
  recommenderTitle: "",
  recommenderOrganization: "",
  contextType: null,
  contextId: null,
  text: "",
  month: null,
  year: null,
  profileUrl: "",
  email: "",
  phone: "",
  featured: false,
  visibility: "Public"
};

const textLimits = {
  firstName: ["First name", 100],
  lastName: ["Last name", 100],
  relationship: ["Relationship", 100],
  recommenderTitle: ["Title", 150],
  recommenderOrganization: ["Organization", 150],
  text: ["Recommendation text", 3000],
  email: ["Email", 254],
  phone: ["Phone", 30]
};

const contextModels = { experience: Experience, education: Education };

// Merges the request onto the existing item (PATCH) or the defaults (POST)
// and validates the result. Returns { data } or { error }.
async function validateRecommendation(body, userId, existing = null) {
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

  if (!KINDS.includes(data.kind)) {
    return { error: "Type must be Recommendation or Reference" };
  }

  for (const [field, [label, max]] of Object.entries(textLimits)) {
    if (typeof data[field] !== "string" || data[field].trim().length > max) {
      return { error: `${label} must be at most ${max} characters` };
    }

    data[field] = data[field].trim();
  }

  if (!data.firstName) return { error: "First name is required" };
  if (!data.relationship) return { error: "Relationship is required" };

  if (data.kind === "Recommendation" && !data.text) {
    return { error: "Recommendation text is required" };
  }

  if (data.month !== null && (!Number.isInteger(data.month) || data.month < 1 || data.month > 12)) {
    return { error: "Invalid month" };
  }

  if (data.year !== null && (!Number.isInteger(data.year) || data.year < 1900 || data.year > 2100)) {
    return { error: "Invalid year" };
  }

  if (data.month !== null && data.year === null) {
    return { error: "Year is required when a month is selected" };
  }

  const now = new Date();

  if (
    data.year !== null &&
    data.year * 12 + (data.month || 1) > now.getFullYear() * 12 + now.getMonth() + 1
  ) {
    return { error: "Date can't be in the future" };
  }

  if (typeof data.profileUrl !== "string") return { error: "Invalid profile URL" };
  data.profileUrl = data.profileUrl.trim();

  if (data.profileUrl && !validUrl(data.profileUrl)) {
    return { error: "Profile URL must start with http:// or https://" };
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { error: "Enter a valid email address" };
  }

  if (data.phone && !/^[+\d\s().-]{5,30}$/.test(data.phone)) {
    return { error: "Phone can contain only digits, spaces and + ( ) - ." };
  }

  for (const field of ["featured"]) {
    if (typeof data[field] !== "boolean") {
      return { error: `${field} must be true or false` };
    }
  }

  if (!["Public", "Private"].includes(data.visibility)) {
    return { error: "Visibility must be Public or Private" };
  }

  // "Where you worked or studied together" must be one of the user's records
  if (data.contextType === null || data.contextType === "") {
    data.contextType = null;
    data.contextId = null;
  } else {
    const Model = Object.hasOwn(contextModels, data.contextType)
      ? contextModels[data.contextType]
      : null;

    if (
      !Model ||
      !mongoose.isValidObjectId(data.contextId) ||
      !(await Model.exists({ _id: data.contextId, userId }))
    ) {
      return { error: "Choose one of your experiences or educations" };
    }
  }

  return { data };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Recommendation error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process recommendation"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.recommendationId)) {
    res.status(400).json({ success: false, message: "Invalid recommendation ID" });
    return null;
  }

  const item = await Recommendation.findOne({
    _id: req.params.recommendationId,
    userId: req.session.userId
  });

  if (!item) {
    res.status(404).json({ success: false, message: "Recommendation not found" });
    return null;
  }

  return item;
}

const months = (item) => (item.year ? item.year * 12 + (item.month || 1) : 0);

// Featured first, then most recent
const newestFirst = (a, b) =>
  Number(b.featured) - Number(a.featured) ||
  months(b) - months(a) ||
  b.createdAt - a.createdAt;

// GET /api/recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const items = await Recommendation.find({ userId: req.session.userId });

    return res.json({
      success: true,
      max: MAX_RECOMMENDATIONS,
      recommendations: items.sort(newestFirst)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/recommendations
exports.createRecommendation = async (req, res) => {
  try {
    const userId = req.session.userId;

    if ((await Recommendation.countDocuments({ userId })) >= MAX_RECOMMENDATIONS) {
      return res.status(400).json({
        success: false,
        message: `You can add up to ${MAX_RECOMMENDATIONS} recommendations and references`
      });
    }

    const result = await validateRecommendation(req.body || {}, userId);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const recommendation = await Recommendation.create({ ...result.data, userId });

    return res.status(201).json({ success: true, recommendation });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/recommendations/:recommendationId
exports.updateRecommendation = async (req, res) => {
  try {
    const recommendation = await findOwned(req, res);
    if (!recommendation) return;

    const result = await validateRecommendation(
      req.body || {},
      req.session.userId,
      recommendation
    );

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    recommendation.set(result.data);
    await recommendation.save();

    return res.json({ success: true, recommendation });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/recommendations/:recommendationId
exports.deleteRecommendation = async (req, res) => {
  try {
    const recommendation = await findOwned(req, res);
    if (!recommendation) return;

    await recommendation.deleteOne();

    return res.json({ success: true, message: "Recommendation deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
