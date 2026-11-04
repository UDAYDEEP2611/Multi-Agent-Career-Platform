const mongoose = require("mongoose");

// On-disk size of databases and their collections (data plus indexes), for
// the admin Storage page and each user's own Storage tab

// Fixed limits (see utils/projectLimits.js)
const { storageLimits } = require("./projectLimits");

async function collectionsOf(dbName) {
  const db = mongoose.connection.client.db(dbName);
  const collections = await db.listCollections({ type: "collection" }).toArray();

  const rows = await Promise.all(
    collections.map(async ({ name }) => {
      try {
        const [stats] = await db.collection(name).aggregate([
          { $collStats: { storageStats: {} } },
          {
            $project: {
              count: "$storageStats.count",
              dataBytes: "$storageStats.size",
              storageBytes: "$storageStats.storageSize",
              indexBytes: "$storageStats.totalIndexSize"
            }
          }
        ]).toArray();

        return {
          name,
          records: stats?.count || 0,
          dataBytes: stats?.dataBytes || 0,
          storageBytes: stats?.storageBytes || 0,
          indexBytes: stats?.indexBytes || 0,
          totalBytes: (stats?.storageBytes || 0) + (stats?.indexBytes || 0)
        };
      } catch {
        return { name, records: 0, dataBytes: 0, storageBytes: 0, indexBytes: 0, totalBytes: 0 };
      }
    })
  );

  return rows.sort((a, b) => b.totalBytes - a.totalBytes);
}

// { name, totalBytes, records, collections: [...] } plus any extra fields
async function describeDatabase(dbName, extra = {}) {
  const collections = await collectionsOf(dbName);

  return {
    name: dbName,
    ...extra,
    totalBytes: collections.reduce((sum, item) => sum + item.totalBytes, 0),
    records: collections.reduce((sum, item) => sum + item.records, 0),
    collections
  };
}

module.exports = { storageLimits, describeDatabase };
