const mongoose = require("mongoose");
const UserSkill = require("../models/UserSkill");
const SkillAssociation = require("../models/SkillAssociation");
const UserSkillQuota = require("../models/UserSkillQuota");
const SkillCatalog = require("../models/SkillCatalog");
const { findSimilar } = require("../utils/skillSimilarity");
const { checkSkillWithAi } = require("../services/skillCheckAi");
const { SKILL_TYPES, normalizeSkillName } = require("../models/UserSkill");
const { SKILL_LIMITS } = require("../models/UserSkillQuota");

const MIN_IMPORTANT_RATING = 3;

const { maxSkills: MAX_SKILLS, maxImportant: MAX_IMPORTANT } = SKILL_LIMITS;

const editableFields = [
  "name",
  "rating",
  "lastUsedYear",
  "skillType",
  "isImportant"
];

// Merges the request onto the existing skill (for PATCH) and validates
// the result. Returns { data } or { error }.
function validateSkill(body, existing = null) {
  for (const key of Object.keys(body)) {
    if (!editableFields.includes(key)) {
      return { error: `Unsupported field: ${key}` };
    }
  }

  const pick = (key, fallback) =>
    body[key] === undefined ? existing?.[key] ?? fallback : body[key];

  const name = pick("name", undefined);
  const rating = pick("rating", 3);
  const lastUsedYear = pick("lastUsedYear", null);
  const skillType = pick("skillType", "technical");
  const isImportant = pick("isImportant", false);

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100
  ) {
    return { error: "Skill name must be 1–100 characters" };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be a whole number from 1 to 5" };
  }

  const currentYear = new Date().getFullYear();

  if (
    lastUsedYear !== null &&
    (!Number.isInteger(lastUsedYear) ||
      lastUsedYear < 1950 ||
      lastUsedYear > currentYear)
  ) {
    return { error: `Last-used year must be between 1950 and ${currentYear}` };
  }

  if (!SKILL_TYPES.includes(skillType)) {
    return { error: "Skill type must be technical or soft" };
  }

  if (typeof isImportant !== "boolean") {
    return { error: "isImportant must be true or false" };
  }

  // Important skills are the strong ones: rated 3/5 or higher
  if (isImportant && rating < MIN_IMPORTANT_RATING) {
    return { error: `Important skills must be rated ${MIN_IMPORTANT_RATING}/5 or higher` };
  }

  const cleanedName = name.trim().replace(/\s+/g, " ");

  return {
    data: {
      name: cleanedName,
      normalizedName: normalizeSkillName(cleanedName),
      rating,
      lastUsedYear,
      skillType,
      isImportant
    }
  };
}

function handleError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "This skill already exists"
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error("User skill error:", error);

  return res.status(500).json({
    success: false,
    message: "Unable to process skill"
  });
}

const limitMessages = {
  maxSkills: `You can add up to ${MAX_SKILLS} skills`,
  maxImportant: `You can mark up to ${MAX_IMPORTANT} skills as important`
};

const limitReached = (res, limit) =>
  res.status(409).json({
    success: false,
    message: limitMessages[limit]
  });

// Which list a skill shows in on the Skills page
const groupOf = (skill) =>
  skill.isImportant ? "important" : skill.skillType;

const GROUP_FILTERS = {
  important: { isImportant: true },
  technical: { isImportant: false, skillType: "technical" },
  soft: { isImportant: false, skillType: "soft" }
};

const GROUP_RANK = { important: 0, technical: 1, soft: 2 };

// Group, then the user's order, then highest rating, then most recently used
const compareSkills = (a, b) =>
  GROUP_RANK[groupOf(a)] - GROUP_RANK[groupOf(b)] ||
  (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) ||
  b.rating - a.rating ||
  (b.lastUsedYear ?? 0) - (a.lastUsedYear ?? 0) ||
  a.normalizedName.localeCompare(b.normalizedName);

// GET /api/skills
exports.getSkills = async (req, res) => {
  try {
    const skills = (await UserSkill.find({ userId: req.session.userId }))
      .sort(compareSkills);

    return res.json({
      success: true,
      total: skills.length,
      importantCount: skills.filter((skill) => skill.isImportant).length,
      limits: {
        maxSkills: MAX_SKILLS,
        maxImportant: MAX_IMPORTANT
      },
      skills
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/skills
// Reserves a quota slot first, then creates; the slot is given back if
// the create fails (e.g. duplicate name).
exports.createSkill = async (req, res) => {
  try {
    const userId = req.session.userId;
    const result = validateSkill(req.body || {});

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    const slots = { total: 1, important: result.data.isImportant ? 1 : 0 };
    const limit = await UserSkillQuota.reserve(userId, slots);

    if (limit) return limitReached(res, limit);

    let skill;

    try {
      skill = await UserSkill.create({
        ...result.data,
        sortOrder: result.data.isImportant ? Date.now() : null,
        userId
      });
    } catch (error) {
      await UserSkillQuota.release(userId, slots);
      throw error;
    }

    return res.status(201).json({
      success: true,
      skill
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/skills/:skillId
// Promoting to important reserves a slot; demoting releases one. The update
// only applies if isImportant hasn't changed since it was read, so two
// simultaneous promotions of the same skill can't count it twice.
exports.updateSkill = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { skillId } = req.params;

    if (!mongoose.isValidObjectId(skillId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid skill ID"
      });
    }

    const skill = await UserSkill.findOne({ _id: skillId, userId });

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: "Skill not found"
      });
    }

    const result = validateSkill(req.body || {}, skill);

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    const promoted = result.data.isImportant && !skill.isImportant;
    const demoted = !result.data.isImportant && skill.isImportant;
    const movedGroup = groupOf(result.data) !== groupOf(skill);

    if (promoted) {
      const limit = await UserSkillQuota.reserve(userId, { important: 1 });
      if (limit) return limitReached(res, limit);
    }

    let updated;

    try {
      updated = await UserSkill.findOneAndUpdate(
        { _id: skillId, userId, isImportant: skill.isImportant },
        {
          $set: {
            ...result.data,
            // A skill moving to another list loses its old position:
            // last in Important, unplaced in Technical/Soft
            ...(movedGroup && { sortOrder: promoted ? Date.now() : null })
          }
        },
        { new: true, runValidators: true }
      );
    } catch (error) {
      if (promoted) await UserSkillQuota.release(userId, { important: 1 });
      throw error;
    }

    if (!updated) {
      if (promoted) await UserSkillQuota.release(userId, { important: 1 });

      return res.status(409).json({
        success: false,
        message: "This skill was changed or deleted elsewhere. Reload and try again."
      });
    }

    if (demoted) await UserSkillQuota.release(userId, { important: 1 });

    return res.json({
      success: true,
      skill: updated
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PUT /api/skills/order  { group, skillIds: [...] }
// group: important | technical | soft. skillIds must be exactly the
// user's skills in that group, in the new order.
exports.reorderSkills = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { group, skillIds } = req.body || {};

    if (
      !Object.hasOwn(GROUP_FILTERS, group) ||
      !Array.isArray(skillIds) ||
      skillIds.length > MAX_SKILLS ||
      !skillIds.every((id) => mongoose.isValidObjectId(id)) ||
      new Set(skillIds.map(String)).size !== skillIds.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid skill order"
      });
    }

    const filter = { userId, ...GROUP_FILTERS[group] };
    const current = await UserSkill.find(filter, { _id: 1 }).lean();
    const currentIds = new Set(current.map((skill) => String(skill._id)));

    if (
      currentIds.size !== skillIds.length ||
      !skillIds.every((id) => currentIds.has(String(id)))
    ) {
      return res.status(409).json({
        success: false,
        message: "Your skills changed. Reload and try again."
      });
    }

    await UserSkill.bulkWrite(
      skillIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id, ...filter },
          update: { $set: { sortOrder: index } }
        }
      }))
    );

    return res.json({
      success: true,
      message: "Order saved"
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/skills/check  { name }
// Before adding a new skill: is it already on the Skills page, does it look
// like one that is (typo, "ReactJS" vs "React"), and is it spelled right?
// Uses Claude when ANTHROPIC_API_KEY is set, plus rule-based matching
// against the user's skills and the skill catalog either way.
exports.checkSkill = async (req, res) => {
  try {
    const userId = req.session.userId;
    const rawName = req.body?.name;

    if (typeof rawName !== "string" || !rawName.trim() || rawName.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Skill name must be 1–100 characters"
      });
    }

    const name = rawName.trim().replace(/\s+/g, " ");
    const normalized = normalizeSkillName(name);

    const skills = await UserSkill.find({ userId }).lean();
    const existing = skills.find((skill) => skill.normalizedName === normalized) || null;

    if (existing) {
      return res.json({
        success: true,
        checkedBy: "rules",
        existing,
        similar: [],
        suggestion: null,
        skillType: existing.skillType
      });
    }

    const catalog = await SkillCatalog.find({}, { name: 1, skillType: 1 }).lean();
    const catalogMatch =
      catalog.find((item) => normalizeSkillName(item.name) === normalized) ||
      findSimilar(name, catalog, 1)[0] ||
      null;

    const ai = await checkSkillWithAi(name, skills.map((skill) => skill.name));

    // Look-alikes already on the Skills page
    const similar = findSimilar(name, skills);
    for (const sameName of ai?.sameAs || []) {
      const skill = skills.find((item) => item.name === sameName);
      if (skill && !similar.includes(skill)) similar.push(skill);
    }

    // A better spelling, if any (also fixes capitalization: "javascript")
    const corrected = ai?.correctedName || catalogMatch?.name || null;
    const suggestion = corrected && corrected !== name ? corrected : null;

    return res.json({
      success: true,
      checkedBy: ai ? "ai" : "rules",
      existing: null,
      similar,
      suggestion,
      skillType: catalogMatch?.skillType || ai?.skillType || "technical"
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/skills/:skillId
// Removes the skill, its links and its quota slots
exports.deleteSkill = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { skillId } = req.params;

    if (!mongoose.isValidObjectId(skillId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid skill ID"
      });
    }

    // Only one of several simultaneous deletes gets the document back
    const skill = await UserSkill.findOneAndDelete({ _id: skillId, userId });

    if (!skill) {
      return res.status(404).json({
        success: false,
        message: "Skill not found"
      });
    }

    await UserSkillQuota.release(userId, {
      total: 1,
      important: skill.isImportant ? 1 : 0
    });

    await SkillAssociation.deleteMany({ userId, skillId: skill._id });

    return res.json({
      success: true,
      message: "Skill deleted successfully"
    });
  } catch (error) {
    return handleError(res, error);
  }
};
