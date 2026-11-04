// Adds the starting skill suggestions. Safe to rerun: existing names are
// left alone. Run from server/: node scripts/seedSkillCatalog.js
require("dotenv").config();

const mongoose = require("mongoose");
const SkillCatalog = require("../models/SkillCatalog");
const { normalizeSkillName } = require("../models/UserSkill");
const skills = require("./skillCatalogData");

async function seedSkillCatalog() {
  const operations = skills.map(({ name, skillType }) => {
    const normalizedName = normalizeSkillName(name);

    return {
      updateOne: {
        filter: { normalizedName },
        update: { $setOnInsert: { name, normalizedName, skillType } },
        upsert: true
      }
    };
  });

  return SkillCatalog.bulkWrite(operations, { ordered: false });
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await SkillCatalog.syncIndexes();

    const result = await seedSkillCatalog();

    console.log(
      `Skill catalog seeded: ${result.upsertedCount} added, ` +
      `${skills.length - result.upsertedCount} already present`
    );
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedSkillCatalog };
