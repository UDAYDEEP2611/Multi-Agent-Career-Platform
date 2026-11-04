const os = require("os");
const mongoose = require("mongoose");
const User = require("../models/User");
const AdminAudit = require("../models/AdminAudit");
const SkillCatalog = require("../models/SkillCatalog");
const { deleteFile } = require("../storage/fileStorage");
const { logAdminAction } = require("../utils/adminAudit");
const { recordAuthEvent } = require("../utils/activityLog");
const { maxUsers } = require("../utils/projectLimits");
const {
  userDbName,
  userDbPrefix,
  preparedDatabaseNames,
  clearPreparedDatabases,
  forgetUserDatabase
} = require("../utils/userDatabase");
const {
  listSessions,
  deleteSessionByHandle,
  deleteSessionsForUser,
  deleteExpiredSessions
} = require("../utils/sessionRecords");

const sendStatus = (res, status, message) =>
  res.status(status).json({ success: false, message });

function handleError(res, error) {
  console.error("Admin error:", error);
  return sendStatus(res, 500, "Unable to complete the admin request");
}

const client = () => mongoose.connection.client;
const mainDbName = () => mongoose.connection.name;

// All user databases: { name, userId, sizeBytes }
async function userDatabases() {
  const prefix = userDbPrefix();
  const { databases } = await mongoose.connection.db.admin().listDatabases();

  return databases
    .filter((db) => db.name.startsWith(prefix) && /^[a-f0-9]{24}$/.test(db.name.slice(prefix.length)))
    .map((db) => ({ name: db.name, userId: db.name.slice(prefix.length), sizeBytes: db.sizeOnDisk || 0 }));
}

async function databaseDetails(name) {
  try {
    const stats = await client().db(name).stats();
    return {
      collections: stats.collections || 0,
      records: stats.objects || 0,
      dataBytes: stats.dataSize || 0
    };
  } catch {
    return { collections: 0, records: 0, dataBytes: 0 };
  }
}

// GET /api/admin/overview
exports.getOverview = async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [users, sessions, databases, recentAudit, catalogCount] = await Promise.all([
      User.find({}, { role: 1, isDisabled: 1, createdAt: 1, lastLoginAt: 1 }).lean(),
      listSessions(),
      userDatabases(),
      AdminAudit.find().sort({ createdAt: -1 }).limit(5).lean(),
      SkillCatalog.countDocuments()
    ]);

    const userIds = new Set(users.map((user) => String(user._id)));
    const mainStats = await databaseDetails(mainDbName());

    return res.json({
      success: true,
      users: {
        total: users.length,
        maxUsers: maxUsers(),
        admins: users.filter((user) => user.role === "admin").length,
        disabled: users.filter((user) => user.isDisabled).length,
        newThisWeek: users.filter((user) => user.createdAt >= weekAgo).length,
        activeThisWeek: users.filter((user) => user.lastLoginAt >= weekAgo).length
      },
      sessions: {
        active: sessions.length,
        signedInUsers: new Set(sessions.map((session) => session.userId).filter(Boolean)).size
      },
      databases: {
        userDatabases: databases.length,
        orphaned: databases.filter((db) => !userIds.has(db.userId)).length,
        totalSizeBytes: databases.reduce((sum, db) => sum + db.sizeBytes, 0),
        main: { name: mainDbName(), ...mainStats }
      },
      catalogCount,
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        cachedDatabases: preparedDatabaseNames().length
      },
      recentAudit
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/admin/sessions
exports.getSessions = async (req, res) => {
  try {
    const sessions = await listSessions();
    const users = await User.find(
      { _id: { $in: sessions.map((session) => session.userId).filter((id) => mongoose.isValidObjectId(id)) } },
      { username: 1, email: 1, role: 1 }
    ).lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));

    return res.json({
      success: true,
      sessions: sessions.map((session) => {
        const user = byId.get(session.userId);

        return {
          handle: session.handle,
          expires: session.expires,
          isCurrent: session.id === req.sessionID,
          user: user
            ? { id: session.userId, username: user.username, email: user.email, role: user.role }
            : session.userId
              ? { id: session.userId, username: "(deleted account)", email: "", role: "" }
              : null
        };
      })
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/admin/sessions/:handle  (sign one session out)
exports.deleteSession = async (req, res) => {
  try {
    const sessions = await listSessions();
    const target = sessions.find((session) => session.handle === req.params.handle);

    if (!target) return sendStatus(res, 404, "Session not found or already ended");

    if (target.id === req.sessionID) {
      return sendStatus(res, 400, "That's your current session. Use Log out instead.");
    }

    await deleteSessionByHandle(req.params.handle);
    await logAdminAction(req, "End session", target.userId || "signed-out visitor");

    return res.json({ success: true, message: "Session ended" });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/admin/sessions/clean-expired
exports.cleanExpiredSessions = async (req, res) => {
  try {
    const removed = await deleteExpiredSessions();
    await logAdminAction(req, "Remove expired sessions", "", `${removed} removed`);

    return res.json({ success: true, removed });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/admin/users/:userId/sign-out  (end all of a user's sessions)
exports.signOutUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) return sendStatus(res, 400, "Invalid user ID");
    if (userId === String(req.session.userId)) {
      return sendStatus(res, 400, "Use Log out to end your own session");
    }

    const ended = await deleteSessionsForUser(userId);
    await logAdminAction(req, "Sign out everywhere", userId, `${ended} sessions ended`);

    const target = await User.findById(userId, { role: 1 }).lean();
    if (target && target.role !== "admin") {
      await recordAuthEvent(req, userId, "signed_out_by_admin", "Signed out of every device by an administrator");
    }

    return res.json({ success: true, ended });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/admin/databases
exports.getDatabases = async (req, res) => {
  try {
    const databases = await userDatabases();
    const users = await User.find({}, { username: 1, email: 1 }).lean();
    const byId = new Map(users.map((user) => [String(user._id), user]));

    const rows = await Promise.all(
      databases.map(async (db) => {
        const owner = byId.get(db.userId);

        return {
          ...db,
          ...(await databaseDetails(db.name)),
          owner: owner ? { id: db.userId, username: owner.username, email: owner.email } : null,
          orphaned: !owner
        };
      })
    );

    const main = { name: mainDbName(), ...(await databaseDetails(mainDbName())) };
    const mainCollections = await mongoose.connection.db.listCollections().toArray();

    main.collectionCounts = await Promise.all(
      mainCollections
        .map((item) => item.name)
        .sort()
        .map(async (name) => ({
          name,
          records: await mongoose.connection.db.collection(name).estimatedDocumentCount()
        }))
    );

    return res.json({
      success: true,
      main,
      // Users with an account but no database yet (created on next sign-in)
      usersWithoutDatabase: users
        .filter((user) => !databases.some((db) => db.userId === String(user._id)))
        .map((user) => ({ id: user._id, username: user.username })),
      databases: rows.sort((a, b) => b.sizeBytes - a.sizeBytes)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Uploaded files referenced anywhere in a user database ({ key, mimeType })
async function fileKeysIn(dbName) {
  const keys = new Set();

  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);

    if (typeof value.key === "string" && typeof value.mimeType === "string") {
      keys.add(value.key);
    }

    Object.values(value).forEach(walk);
  };

  const db = client().db(dbName);

  for (const { name } of await db.listCollections().toArray()) {
    for await (const doc of db.collection(name).find()) walk(doc);
  }

  return [...keys];
}

// Drops a user database and deletes the uploaded files it referenced
async function dropUserDatabase(userId) {
  const name = userDbName(userId);
  const keys = await fileKeysIn(name);

  await client().db(name).dropDatabase();
  forgetUserDatabase(userId);

  for (const key of keys) await deleteFile(key);

  return keys.length;
}

// DELETE /api/admin/databases/:userId  { confirm: <database name> }
// Only for databases whose account no longer exists
exports.deleteOrphanedDatabase = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!/^[a-f0-9]{24}$/.test(userId)) return sendStatus(res, 400, "Invalid database");

    const name = userDbName(userId);

    if (req.body?.confirm !== name) {
      return sendStatus(res, 400, "Type the database name to confirm");
    }

    if (await User.exists({ _id: userId })) {
      return sendStatus(res, 400, "This database belongs to an existing account. Delete the account instead.");
    }

    if (!(await userDatabases()).some((db) => db.name === name)) {
      return sendStatus(res, 404, "Database not found");
    }

    const files = await dropUserDatabase(userId);
    await logAdminAction(req, "Delete orphaned database", name, `${files} files removed`);

    return res.json({ success: true, message: "Database deleted", filesRemoved: files });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE /api/admin/users/:userId  { confirm: <username> }
// Deletes the account, its database, its uploaded files and its sessions
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) return sendStatus(res, 400, "Invalid user ID");
    if (userId === String(req.session.userId)) {
      return sendStatus(res, 400, "You can't delete your own account here");
    }

    const user = await User.findById(userId);
    if (!user) return sendStatus(res, 404, "User not found");

    if (req.body?.confirm !== user.username) {
      return sendStatus(res, 400, "Type the username to confirm");
    }

    // Sessions first, so the user can't keep working while data is removed
    const ended = await deleteSessionsForUser(userId);
    const files = await dropUserDatabase(userId);
    await user.deleteOne();

    await logAdminAction(
      req,
      "Delete account",
      `${user.username} (${user.email})`,
      `database dropped, ${files} files and ${ended} sessions removed`
    );

    return res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/admin/system
exports.getSystem = async (req, res) => {
  try {
    const memory = process.memoryUsage();
    let mongoVersion = "unknown";

    try {
      mongoVersion = (await mongoose.connection.db.admin().buildInfo()).version;
    } catch {
      // Not allowed on some hosted plans
    }

    return res.json({
      success: true,
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()}`,
        environment: process.env.NODE_ENV || "development",
        memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal }
      },
      database: {
        state: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown",
        mongoVersion,
        mainDatabase: mainDbName(),
        userDatabasePrefix: userDbPrefix()
      },
      cache: {
        preparedDatabases: preparedDatabaseNames()
      },
      aiSkillCheck: Boolean(process.env.ANTHROPIC_API_KEY)
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/admin/system/clear-cache
exports.clearCache = async (req, res) => {
  try {
    const cleared = clearPreparedDatabases();
    await logAdminAction(req, "Clear database cache", "", `${cleared} entries cleared`);

    return res.json({ success: true, cleared });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/admin/audit?limit=100
exports.getAudit = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
    const entries = await AdminAudit.find().sort({ createdAt: -1 }).limit(limit).lean();

    return res.json({ success: true, entries });
  } catch (error) {
    return handleError(res, error);
  }
};
