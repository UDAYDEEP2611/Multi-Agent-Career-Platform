const mongoose = require("mongoose");
const Interest = require("../models/Interest");
const { CATEGORIES } = require("../models/Interest");

const MAX_INTERESTS = 30;

const editableFields = ["name", "category", "description"];

// Merges the request onto the existing interest (PATCH) and validates the
// result. Returns { data } or { error }.
function validateInterest(body, existing = null) {
  for (const key of Object.keys(body)) {
    if (!editableFields.includes(key)) {
      return { error: `Unsupported field: ${key}` };
    }
  }

  const pick = (key, fallback) =>
    body[key] === undefined ? existing?.[key] ?? fallback : body[key];

  const name = pick("name", "");
  const category = pick("category", "Other");
  const description = pick("description", "");

  if (typeof name !== "string" || !name.trim() || name.trim().length > 60) {
    return { error: "Interest name must be 1–60 characters" };
  }

  if (!CATEGORIES.includes(category)) {
    return { error: "Invalid category" };
  }

  if (typeof description !== "string" || description.trim().length > 300) {
    return { error: "Description must be at most 300 characters" };
  }

  return {
    data: {
      name: name.trim().replace(/\s+/g, " "),
      category,
      description: description.trim()
    }
  };
}

function handleError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "You already added this interest"
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error("Interest error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process interest"
  });
}

async function findOwned(req, res) {
  if (!mongoose.isValidObjectId(req.params.interestId)) {
    res.status(400).json({ success: false, message: "Invalid interest ID" });
    return null;
  }

  const interest = await Interest.findOne({
    _id: req.params.interestId,
    userId: req.session.userId
  });

  if (!interest) {
    res.status(404).json({ success: false, message: "Interest not found" });
    return null;
  }

  return interest;
}

// GET /api/interests (oldest first, so pills keep their place)
exports.getInterests = async (req, res) => {
  try {
    const interests = await Interest.find({ userId: req.session.userId })
      .sort({ createdAt: 1 });

    return res.json({ success: true, max: MAX_INTERESTS, interests });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/interests
exports.createInterest = async (req, res) => {
  try {
    const userId = req.session.userId;

    if ((await Interest.countDocuments({ userId })) >= MAX_INTERESTS) {
      return res.status(400).json({
        success: false,
        message: `You can add up to ${MAX_INTERESTS} interests`
      });
    }

    const result = validateInterest(req.body || {});

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const interest = await Interest.create({ ...result.data, userId });

    return res.status(201).json({ success: true, interest });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/interests/:interestId
exports.updateInterest = async (req, res) => {
  try {
    const interest = await findOwned(req, res);
    if (!interest) return;

    const result = validateInterest(req.body || {}, interest);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    interest.set(result.data);
    await interest.save();

    return res.json({ success: true, interest });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/interests/:interestId
exports.deleteInterest = async (req, res) => {
  try {
    const interest = await findOwned(req, res);
    if (!interest) return;

    await interest.deleteOne();

    return res.json({ success: true, message: "Interest deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
