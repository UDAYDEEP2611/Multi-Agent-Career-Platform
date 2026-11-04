// Moves user databases from an old naming scheme to the current one
// (utils/userDatabase.js), e.g. "AgenticAgentPortfolioSystem_user_<id>" to
// "user_db_<id>". MongoDB can't rename databases, so each one is copied,
// the record counts are checked, and only then is the old one dropped.
// Safe to rerun.
// Run from server/: npm run rename:user-dbs -- <old prefix>
// (default old prefix: "<main database>_user_")
require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const { prepareUserDatabase, userDbName } = require("../utils/userDatabase");
require("../models/userModels");

async function renameUserDatabases(oldPrefix) {
  const client = mongoose.connection.client;
  const { databases } = await mongoose.connection.db.admin().listDatabases({ nameOnly: true });
  const report = [];

  for (const { name: oldName } of databases) {
    const userId = oldName.slice(oldPrefix.length);

    if (!oldName.startsWith(oldPrefix) || !/^[a-f0-9]{24}$/.test(userId)) continue;

    const newName = userDbName(userId);
    if (newName === oldName) continue;

    await prepareUserDatabase(userId);

    const source = client.db(oldName);
    const target = client.db(newName);
    let allCopied = true;
    let records = 0;

    for (const { name: collection } of await source.listCollections().toArray()) {
      const docs = await source.collection(collection).find().toArray();
      const existing = new Set(
        (await target.collection(collection)
          .find({ _id: { $in: docs.map((doc) => doc._id) } }, { projection: { _id: 1 } })
          .toArray())
          .map((doc) => String(doc._id))
      );
      const missing = docs.filter((doc) => !existing.has(String(doc._id)));

      if (missing.length > 0) {
        await target.collection(collection).insertMany(missing, { ordered: false });
      }

      const present = await target.collection(collection)
        .countDocuments({ _id: { $in: docs.map((doc) => doc._id) } });

      if (present !== docs.length) allCopied = false;
      records += docs.length;
    }

    if (allCopied) await source.dropDatabase();

    report.push({ oldName, newName, records, dropped: allCopied });
  }

  return report;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const oldPrefix = process.argv[2] || `${mongoose.connection.name}_user_`;
    const report = await renameUserDatabases(oldPrefix);

    if (report.length === 0) console.log(`No databases named ${oldPrefix}<id> found`);

    for (const row of report) {
      console.log(
        `${row.oldName} -> ${row.newName}: ${row.records} records` +
        (row.dropped ? ", old database dropped" : ", copy incomplete, old database kept")
      );
    }
  } catch (error) {
    console.error("Rename failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { renameUserDatabases };
