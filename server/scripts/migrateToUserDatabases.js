// Copies portfolio records from the main database into each owner's own
// database (see utils/userDatabase.js). Safe to rerun: records already
// copied are skipped. The originals are kept unless --remove-old is given,
// and then only records verified in the user's database are removed.
// Run from server/: npm run migrate:user-dbs [-- --remove-old]
require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const {
  prepareUserDatabase,
  userDbName,
  userModelCollections
} = require("../utils/userDatabase");
require("../models/userModels");

async function migrateToUserDatabases({ removeOld = false } = {}) {
  const main = mongoose.connection.db;
  const client = mongoose.connection.client;
  const report = [];

  for (const { collection } of userModelCollections()) {
    const source = main.collection(collection);
    const ownerIds = (await source.distinct("userId")).filter(Boolean).map(String);
    let copied = 0;
    let removed = 0;

    for (const userId of ownerIds) {
      await prepareUserDatabase(userId);
      const target = client.db(userDbName(userId)).collection(collection);

      const docs = await source.find({ userId: new mongoose.Types.ObjectId(userId) }).toArray();
      const existing = new Set(
        (await target.find({ _id: { $in: docs.map((doc) => doc._id) } }, { projection: { _id: 1 } }).toArray())
          .map((doc) => String(doc._id))
      );
      const missing = docs.filter((doc) => !existing.has(String(doc._id)));

      if (missing.length > 0) {
        await target.insertMany(missing, { ordered: false });
        copied += missing.length;
      }

      if (removeOld) {
        // Remove only what is now verifiably in the user's database
        const ids = docs.map((doc) => doc._id);
        const present = await target.countDocuments({ _id: { $in: ids } });

        if (present === ids.length) {
          removed += (await source.deleteMany({ _id: { $in: ids } })).deletedCount;
        } else {
          console.warn(`Kept ${collection} for user ${userId}: copy incomplete`);
        }
      }
    }

    const unowned = await source.countDocuments({ userId: { $in: [null, undefined] } });
    report.push({ collection, users: ownerIds.length, copied, removed, unowned });
  }

  return report;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exitCode = 1;
    return;
  }

  const removeOld = process.argv.includes("--remove-old");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const report = await migrateToUserDatabases({ removeOld });

    for (const row of report) {
      console.log(
        `${row.collection}: ${row.users} users, ${row.copied} copied` +
        (removeOld ? `, ${row.removed} removed from main` : "") +
        (row.unowned ? `, ${row.unowned} without an owner (left as is)` : "")
      );
    }

    if (!removeOld) {
      console.log("Originals kept. Rerun with --remove-old to remove them from the main database.");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateToUserDatabases };
