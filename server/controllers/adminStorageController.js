const mongoose = require("mongoose");
const User = require("../models/User");
const { userDbPrefix } = require("../utils/userDatabase");
const { storageLimits: limits, describeDatabase: describe } = require("../utils/databaseStorage");

// GET /api/admin/storage
// Used space against the fixed limits, per database and per collection
exports.getStorage = async (req, res) => {
  try {
    const prefix = userDbPrefix();
    const mainName = mongoose.connection.name;
    const { databases } = await mongoose.connection.db.admin().listDatabases({ nameOnly: true });
    const users = await User.find({}, { username: 1, email: 1 }).lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));

    const userDbs = databases
      .map((db) => db.name)
      .filter((name) => name.startsWith(prefix) && /^[a-f0-9]{24}$/.test(name.slice(prefix.length)));

    const main = await describe(mainName, { kind: "main", owner: null });
    const perUser = await Promise.all(
      userDbs.map((name) => {
        const userId = name.slice(prefix.length);
        const owner = byId.get(userId);

        return describe(name, {
          kind: "user",
          userId,
          owner: owner ? { username: owner.username, email: owner.email } : null
        });
      })
    );

    const all = [main, ...perUser.sort((a, b) => b.totalBytes - a.totalBytes)];

    return res.json({
      success: true,
      limits: limits(),
      usedBytes: all.reduce((sum, db) => sum + db.totalBytes, 0),
      databases: all
    });
  } catch (error) {
    console.error("Admin storage error:", error);
    return res.status(500).json({ success: false, message: "Unable to read storage" });
  }
};
