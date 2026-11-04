// Goes through every user's database, resets their skill counters to their
// actual skills and removes skill links whose skill or record no longer
// exists. Without transactions
// a crash mid-request can leave either slightly off; this fixes both.
// Safe to rerun. Best run while the server is stopped.
// Run from server/: npm run repair:skills
require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const UserSkill = require("../models/UserSkill");
const UserSkillQuota = require("../models/UserSkillQuota");
const SkillAssociation = require("../models/SkillAssociation");
const Experience = require("../models/Experience");
const Education = require("../models/Education");
const Project = require("../models/Project");
const Certification = require("../models/Certification");
const {
  listUserIds,
  prepareUserDatabase,
  runAsUser
} = require("../utils/userDatabase");
require("../models/userModels");

// IDs of everything in this user's database a link can point at
async function existingSourceIds() {
  const ids = new Set();

  for (const Model of [Experience, Education]) {
    const parents = await Model.find({}, { _id: 1, "projects._id": 1 }).lean();

    for (const parent of parents) {
      ids.add(String(parent._id));
      for (const project of parent.projects || []) ids.add(String(project._id));
    }
  }

  for (const Model of [Project, Certification]) {
    for (const record of await Model.find({}, { _id: 1 }).lean()) {
      ids.add(String(record._id));
    }
  }

  return ids;
}

// Fixes one user's counters and links, inside their own database
async function repairUser(userId) {
  await prepareUserDatabase(userId);

  return runAsUser(userId, async () => {
    await UserSkillQuota.recount(userId);

    const skillIds = new Set((await UserSkill.distinct("_id")).map(String));
    const sourceIds = await existingSourceIds();

    const orphans = (await SkillAssociation.find({}, { skillId: 1, sourceId: 1 }).lean())
      .filter((link) =>
        !skillIds.has(String(link.skillId)) || !sourceIds.has(String(link.sourceId))
      )
      .map((link) => link._id);

    if (orphans.length > 0) {
      await SkillAssociation.deleteMany({ _id: { $in: orphans } });
    }

    return orphans.length;
  });
}

async function repairSkillData() {
  const userIds = await listUserIds();
  let orphanLinksRemoved = 0;

  for (const userId of userIds) {
    orphanLinksRemoved += await repairUser(userId);
  }

  return { quotas: userIds.length, orphanLinksRemoved };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await repairSkillData();
    console.log(
      `Recounted ${result.quotas} users' skill quotas; ` +
      `removed ${result.orphanLinksRemoved} orphaned skill links`
    );
  } catch (error) {
    console.error("Repair failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { repairSkillData };
