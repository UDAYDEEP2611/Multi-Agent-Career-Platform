const mongoose = require("mongoose");
const Achievement = require("../models/Achievement");
const Experience = require("../models/Experience");
const Education = require("../models/Education");
const { CATEGORIES } = require("../models/Achievement");
const { deleteFile } = require("../storage/fileStorage");
const validUrl = require("../utils/validUrl");

const MAX_ACHIEVEMENTS = 100;

const editableFields = [
  "title",
  "category",
  "issuer",
  "result",
  "contextType",
  "contextId",
  "month",
  "year",
  "description",
  "url",
  "featured"
];

const defaults = {
  title: "",
  category: "",
  issuer: "",
  result: "",
  contextType: null,
  contextId: null,
  month: null,
  year: null,
  description: "",
  url: "",
  featured: false
};

const textLimits = {
  title: ["Title", 200],
  issuer: ["Issuer", 200],
  result: ["Result", 100],
  description: ["Description", 2000],
  url: ["Link", 2048]
};

const contextModels = { experience: Experience, education: Education };

// Merges the request onto the existing item (PATCH) or the defaults (POST)
// and validates the result. Returns { data } or { error }.
async function validateAchievement(body, userId, existing = null) {
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

  if (!data.title) return { error: "Title is required" };

  if (!CATEGORIES.includes(data.category)) {
    return { error: "Choose a category" };
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

  if (data.url && !validUrl(data.url)) {
    return { error: "Link must start with http:// or https://" };
  }

  if (typeof data.featured !== "boolean") {
    return { error: "featured must be true or false" };
  }

  // "Associated with" must be one of the user's own records
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

  console.error("Achievement error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process achievement"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.activityId)) {
    res.status(400).json({ success: false, message: "Invalid achievement ID" });
    return null;
  }

  const item = await Achievement.findOne({
    _id: req.params.activityId,
    userId: req.session.userId
  });

  if (!item) {
    res.status(404).json({ success: false, message: "Achievement not found" });
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

// GET /api/achievements
exports.getAchievements = async (req, res) => {
  try {
    const items = await Achievement.find({ userId: req.session.userId });

    return res.json({
      success: true,
      max: MAX_ACHIEVEMENTS,
      achievements: items.sort(newestFirst)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/achievements/:activityId
exports.getAchievement = async (req, res) => {
  try {
    const achievement = await findOwned(req, res);
    if (!achievement) return;

    return res.json({ success: true, achievement });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/achievements
exports.createAchievement = async (req, res) => {
  try {
    const userId = req.session.userId;

    if ((await Achievement.countDocuments({ userId })) >= MAX_ACHIEVEMENTS) {
      return res.status(400).json({
        success: false,
        message: `You can add up to ${MAX_ACHIEVEMENTS} activities and achievements`
      });
    }

    const result = await validateAchievement(req.body || {}, userId);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const achievement = await Achievement.create({ ...result.data, userId });

    return res.status(201).json({ success: true, achievement });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/achievements/:activityId
exports.updateAchievement = async (req, res) => {
  try {
    const achievement = await findOwned(req, res);
    if (!achievement) return;

    const result = await validateAchievement(req.body || {}, req.session.userId, achievement);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    achievement.set(result.data);
    await achievement.save();

    return res.json({ success: true, achievement });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/achievements/:activityId
// Removes the achievement and its uploaded files
exports.deleteAchievement = async (req, res) => {
  try {
    const achievement = await findOwned(req, res);
    if (!achievement) return;

    const fileKeys = achievement.media.map((item) => item.file?.key);

    await achievement.deleteOne();

    for (const key of fileKeys) {
      await deleteFile(key);
    }

    return res.json({ success: true, message: "Achievement deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
