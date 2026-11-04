const mongoose = require("mongoose");
const User = require("../models/User");
const SkillCatalog = require("../models/SkillCatalog");
const { ROLES } = require("../models/User");
const { SKILL_TYPES } = require("../models/UserSkill");
const { userDbName, dropUserDatabaseIfEmpty } = require("../utils/userDatabase");
const { logAdminAction } = require("../utils/adminAudit");
const { deleteSessionsForUser } = require("../utils/sessionRecords");
const { recordAuthEvent } = require("../utils/activityLog");
const { maxUsers } = require("../utils/projectLimits");

const sendStatus = (res, status, message) =>
  res.status(status).json({ success: false, message });

function handleError(res, error) {
  if (error.code === 11000) {
    return sendStatus(res, 409, "That skill is already in the list");
  }

  if (error.name === "ValidationError") {
    return sendStatus(res, 400, error.message);
  }

  console.error("Admin error:", error);
  return sendStatus(res, 500, "Unable to complete the admin request");
}

// Size of one user's own database (0s when they haven't saved anything)
async function databaseStats(userId) {
  try {
    const stats = await mongoose.connection.client.db(userDbName(userId)).stats();
    return { records: stats.objects || 0, sizeBytes: stats.storageSize || 0 };
  } catch {
    return { records: 0, sizeBytes: 0 };
  }
}

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  isDisabled: user.isDisabled,
  authProviders: user.authProviders,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt
});

// GET /api/admin/users
// Every account with its role, status and database size
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const withStats = await Promise.all(
      users.map(async (user) => ({
        ...publicUser(user),
        database: { name: userDbName(user._id), ...(await databaseStats(user._id)) }
      }))
    );

    return res.json({
      success: true,
      currentUserId: req.session.userId,
      summary: {
        total: users.length,
        maxUsers: maxUsers(),
        admins: users.filter((user) => user.role === "admin").length,
        disabled: users.filter((user) => user.isDisabled).length,
        totalSizeBytes: withStats.reduce((sum, user) => sum + user.database.sizeBytes, 0)
      },
      users: withStats
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PATCH /api/admin/users/:userId  { role?, isDisabled? }
// Admins can't change their own access, so whoever demotes an admin is
// another active admin and the site keeps at least one. (If all admins are
// lost anyway, npm run make-admin restores one.)
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, isDisabled, ...rest } = req.body || {};

    if (Object.keys(rest).length > 0) {
      return sendStatus(res, 400, `Unsupported field: ${Object.keys(rest)[0]}`);
    }

    if (!mongoose.isValidObjectId(userId)) {
      return sendStatus(res, 400, "Invalid user ID");
    }

    if (role !== undefined && !ROLES.includes(role)) {
      return sendStatus(res, 400, "Role must be user or admin");
    }

    if (isDisabled !== undefined && typeof isDisabled !== "boolean") {
      return sendStatus(res, 400, "isDisabled must be true or false");
    }

    if (String(userId) === String(req.session.userId)) {
      return sendStatus(res, 400, "You can't change your own access");
    }

    const user = await User.findById(userId);
    if (!user) return sendStatus(res, 404, "User not found");

    const changes = [];
    if (role !== undefined && role !== user.role) changes.push(`role ${user.role} → ${role}`);
    if (isDisabled !== undefined && isDisabled !== user.isDisabled) {
      changes.push(isDisabled ? "disabled" : "enabled");
    }

    if (role !== undefined) user.role = role;
    if (isDisabled !== undefined) user.isDisabled = isDisabled;
    await user.save();

    // A disabled user is signed out everywhere straight away
    if (isDisabled === true) {
      await deleteSessionsForUser(user._id);
      if (user.role !== "admin") {
        await recordAuthEvent(req, user._id, "disabled_by_admin", "Account disabled by an administrator");
      }
    }

    // Admins have no portfolio: an empty user database is removed (one
    // with data is kept in case the account becomes a regular user again)
    if (role === "admin" && (await dropUserDatabaseIfEmpty(user._id))) {
      changes.push("empty portfolio database removed");
    }

    if (changes.length > 0) {
      await logAdminAction(req, "Change access", `${user.username} (${user.email})`, changes.join(", "));
    }

    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/admin/skill-catalog
exports.getCatalog = async (req, res) => {
  try {
    const skills = await SkillCatalog.find().sort({ skillType: 1, normalizedName: 1 });
    return res.json({ success: true, skills });
  } catch (error) {
    return handleError(res, error);
  }
};

function validateCatalogSkill(body, existing = null) {
  const { name = existing?.name, skillType = existing?.skillType ?? "technical", ...rest } = body || {};

  if (Object.keys(rest).length > 0) {
    return { error: `Unsupported field: ${Object.keys(rest)[0]}` };
  }

  if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return { error: "Skill name must be 1–100 characters" };
  }

  if (!SKILL_TYPES.includes(skillType)) {
    return { error: "Skill type must be technical or soft" };
  }

  return { data: { name: name.trim().replace(/\s+/g, " "), skillType } };
}

// POST /api/admin/skill-catalog  { name, skillType }
exports.createCatalogSkill = async (req, res) => {
  try {
    const result = validateCatalogSkill(req.body);
    if (result.error) return sendStatus(res, 400, result.error);

    const skill = await SkillCatalog.create(result.data);
    await logAdminAction(req, "Add skill suggestion", skill.name, skill.skillType);
    return res.status(201).json({ success: true, skill });
  } catch (error) {
    return handleError(res, error);
  }
};

async function findCatalogSkill(req, res) {
  if (!mongoose.isValidObjectId(req.params.skillId)) {
    sendStatus(res, 400, "Invalid skill ID");
    return null;
  }

  const skill = await SkillCatalog.findById(req.params.skillId);
  if (!skill) sendStatus(res, 404, "Skill not found");
  return skill;
}

// PATCH /api/admin/skill-catalog/:skillId
exports.updateCatalogSkill = async (req, res) => {
  try {
    const skill = await findCatalogSkill(req, res);
    if (!skill) return;

    const result = validateCatalogSkill(req.body, skill);
    if (result.error) return sendStatus(res, 400, result.error);

    const before = skill.name;
    skill.set(result.data);
    await skill.save();
    await logAdminAction(req, "Edit skill suggestion", before, `${skill.name} (${skill.skillType})`);
    return res.json({ success: true, skill });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/admin/skill-catalog/:skillId
// Only removes the suggestion; users' own skills are untouched
exports.deleteCatalogSkill = async (req, res) => {
  try {
    const skill = await findCatalogSkill(req, res);
    if (!skill) return;

    await skill.deleteOne();
    await logAdminAction(req, "Remove skill suggestion", skill.name);
    return res.json({ success: true, message: "Suggestion removed" });
  } catch (error) {
    return handleError(res, error);
  }
};
