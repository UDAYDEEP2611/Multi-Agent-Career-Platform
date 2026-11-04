const mongoose = require("mongoose");
const Publication = require("../models/Publication");
const validUrl = require("../utils/validUrl");
const { validPastDate, cleanNames } = require("../utils/calendarDate");

const MAX_PUBLICATIONS = 50;
const MAX_CO_AUTHORS = 20;

const editableFields = ["title", "publisher", "publishedOn", "coAuthors", "url", "description"];

const defaults = {
  title: "",
  publisher: "",
  publishedOn: null,
  coAuthors: [],
  url: "",
  description: ""
};

const textLimits = {
  title: ["Title", 255],
  publisher: ["Publication/Publisher", 255],
  url: ["Publication URL", 2048],
  description: ["Description", 2000]
};

// Merges the request onto the existing publication (PATCH) or the defaults
// (POST) and validates the result. Returns { data } or { error }.
function validatePublication(body, existing = null) {
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

  if (data.publishedOn === "") data.publishedOn = null;

  if (data.publishedOn !== null && !validPastDate(data.publishedOn)) {
    return { error: "Publication date must be a real date that isn't in the future" };
  }

  if (data.url && !validUrl(data.url)) {
    return { error: "Publication URL must start with http:// or https://" };
  }

  const authors = cleanNames(data.coAuthors, { max: MAX_CO_AUTHORS, label: "author" });
  if (authors.error) return { error: authors.error };
  data.coAuthors = authors.names;

  return { data };
}

function handleError(res, error) {
  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Publication error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process publication"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.publicationId)) {
    res.status(400).json({ success: false, message: "Invalid publication ID" });
    return null;
  }

  const publication = await Publication.findOne({
    _id: req.params.publicationId,
    userId: req.session.userId
  });

  if (!publication) {
    res.status(404).json({ success: false, message: "Publication not found" });
    return null;
  }

  return publication;
}

// Newest publication date first; undated ones last, newest added first
const newestFirst = (a, b) =>
  (b.publishedOn || "").localeCompare(a.publishedOn || "") ||
  b.createdAt - a.createdAt;

// GET /api/publications
exports.getPublications = async (req, res) => {
  try {
    const publications = await Publication.find({ userId: req.session.userId });

    return res.json({
      success: true,
      max: MAX_PUBLICATIONS,
      publications: publications.sort(newestFirst)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/publications
exports.createPublication = async (req, res) => {
  try {
    const userId = req.session.userId;

    if ((await Publication.countDocuments({ userId })) >= MAX_PUBLICATIONS) {
      return res.status(400).json({
        success: false,
        message: `You can add up to ${MAX_PUBLICATIONS} publications`
      });
    }

    const result = validatePublication(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const publication = await Publication.create({ ...result.data, userId });

    return res.status(201).json({ success: true, publication });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/publications/:publicationId
exports.updatePublication = async (req, res) => {
  try {
    const publication = await findOwned(req, res);
    if (!publication) return;

    const result = validatePublication(req.body || {}, publication);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    publication.set(result.data);
    await publication.save();

    return res.json({ success: true, publication });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/publications/:publicationId
exports.deletePublication = async (req, res) => {
  try {
    const publication = await findOwned(req, res);
    if (!publication) return;

    await publication.deleteOne();

    return res.json({ success: true, message: "Publication deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
