const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");
const UserSkill = require("./UserSkill");

const SKILL_LIMITS = {
  maxSkills: 120,
  maxImportant: 50
};

// One counter document per user. Every skill create, delete and
// important-status change reserves or releases its slot here with a single
// conditional update, so simultaneous requests can't push a user past the
// limits. This works without transactions (the local MongoDB is standalone).
const userSkillQuotaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      immutable: true
    },

    totalSkills: {
      type: Number,
      default: 0,
      min: 0
    },

    importantSkills: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    collection: "user_skill_quotas"
  }
);

// Actual counts from user_skills
async function countSkills(userId) {
  const [counts] = await UserSkill.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: null,
        totalSkills: { $sum: 1 },
        importantSkills: { $sum: { $cond: ["$isImportant", 1, 0] } }
      }
    }
  ]);

  return {
    totalSkills: counts?.totalSkills || 0,
    importantSkills: counts?.importantSkills || 0
  };
}

// Creates the user's counter from their existing skills the first time
userSkillQuotaSchema.statics.ensureFor = async function (userId) {
  if (await this.exists({ userId })) return;

  try {
    await this.create({ userId, ...(await countSkills(userId)) });
  } catch (error) {
    // Another request created it first
    if (error.code !== 11000) throw error;
  }
};

// Takes slots if they're free. Returns null on success, or the name of the
// limit that was hit ("maxSkills" or "maxImportant").
userSkillQuotaSchema.statics.reserve = async function (
  userId,
  { total = 0, important = 0 }
) {
  await this.ensureFor(userId);

  const filter = { userId };
  if (total > 0) filter.totalSkills = { $lte: SKILL_LIMITS.maxSkills - total };
  if (important > 0) {
    filter.importantSkills = { $lte: SKILL_LIMITS.maxImportant - important };
  }

  const result = await this.updateOne(filter, {
    $inc: { totalSkills: total, importantSkills: important }
  });

  if (result.modifiedCount === 1) return null;

  const quota = await this.findOne({ userId }).lean();

  return total > 0 && quota.totalSkills + total > SKILL_LIMITS.maxSkills
    ? "maxSkills"
    : "maxImportant";
};

// Gives slots back after a delete, a demotion, or a failed write
userSkillQuotaSchema.statics.release = function (
  userId,
  { total = 0, important = 0 }
) {
  return this.updateOne(
    { userId },
    { $inc: { totalSkills: -total, importantSkills: -important } }
  );
};

// Resets a user's counter to their actual skills (repair script)
userSkillQuotaSchema.statics.recount = async function (userId) {
  return this.updateOne(
    { userId },
    { $set: await countSkills(userId) },
    { upsert: true }
  );
};

const UserSkillQuota = userModel("UserSkillQuota", userSkillQuotaSchema);

module.exports = UserSkillQuota;
module.exports.SKILL_LIMITS = SKILL_LIMITS;
