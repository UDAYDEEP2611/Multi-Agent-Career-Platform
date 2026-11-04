const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { recordAuthEvent } = require("../utils/activityLog");
const { verifyGoogleCredential } = require("../services/googleAuth");
const { listSessions, deleteOtherSessions } = require("../utils/sessionRecords");
const { userDbName } = require("../utils/userDatabase");
const { storageLimits, describeDatabase } = require("../utils/databaseStorage");

// The Activity Log page is locked; re-entering the password opens it for
// this long (per session)
const UNLOCK_MINUTES = 10;
// A Google confirmation must be this fresh to open the log
const GOOGLE_FRESH_SECONDS = 5 * 60;

const lockStatus = (req) => {
  const until = req.session.activityUnlockedUntil || 0;
  return until > Date.now()
    ? { unlocked: true, unlockedUntil: new Date(until).toISOString() }
    : { unlocked: false, unlockedUntil: null };
};

// Lets a request through only while the log is unlocked
exports.requireUnlocked = (req, res, next) => {
  if (lockStatus(req).unlocked) return next();

  return res.status(423).json({
    success: false,
    locked: true,
    message: "Your activity log is locked. Confirm it's you to open it."
  });
};

// GET /api/account/lock
exports.getLock = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select("+passwordHash googleId").lean();
    return res.json({
      success: true,
      unlockMinutes: UNLOCK_MINUTES,
      // How this account can confirm it's them
      hasPassword: Boolean(user?.passwordHash),
      hasGoogle: Boolean(user?.googleId),
      ...lockStatus(req)
    });
  } catch (error) {
    console.error("Lock status error:", error);
    return res.status(500).json({ success: false, message: "Unable to check the lock" });
  }
};

const openLog = async (req, res, user) => {
  req.session.activityUnlockedUntil = Date.now() + UNLOCK_MINUTES * 60 * 1000;
  await recordAuthEvent(req, user._id, "unlocked", "Opened the activity log");
  return res.json({ success: true, ...lockStatus(req) });
};

// POST /api/account/unlock  { password } or { credential }
// The user is already signed in; re-entering the password, or confirming with
// the Google account connected to this account, opens the log
exports.unlock = async (req, res) => {
  try {
    const { password, credential } = req.body || {};

    if (credential !== undefined) {
      const user = await User.findById(req.session.userId).select("googleId");
      const google = await verifyGoogleCredential(credential);
      const fresh = google && Date.now() / 1000 - google.issuedAt <= GOOGLE_FRESH_SECONDS;

      if (!user?.googleId || !fresh || google.googleId !== user.googleId) {
        if (user) await recordAuthEvent(req, user._id, "unlock_failed", "Google confirmation on the activity log failed");
        return res.status(401).json({ success: false, message: "That Google account couldn't confirm it's you" });
      }

      return openLog(req, res, user);
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Enter your password" });
    }

    const user = await User.findById(req.session.userId).select("+passwordHash");

    if (!user?.passwordHash) {
      return res.status(400).json({ success: false, message: "This account has no password to check" });
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await recordAuthEvent(req, user._id, "unlock_failed", "Wrong password on the activity log");
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    return openLog(req, res, user);
  } catch (error) {
    console.error("Unlock error:", error);
    return res.status(500).json({ success: false, message: "Unable to unlock" });
  }
};

// POST /api/account/lock
exports.lock = (req, res) => {
  delete req.session.activityUnlockedUntil;
  return res.json({ success: true, unlocked: false, unlockedUntil: null });
};

// GET /api/account/activity?kind=data|auth&limit=200
exports.getActivity = async (req, res) => {
  try {
    const filter = ["data", "auth"].includes(req.query.kind) ? { kind: req.query.kind } : {};
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 200, 1), 1000);

    const entries = await ActivityLog.find(filter, { userId: 0, __v: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, entries });
  } catch (error) {
    console.error("Activity error:", error);
    return res.status(500).json({ success: false, message: "Unable to load activity" });
  }
};

// GET /api/account/sessions  (where this account is signed in now)
exports.getSessions = async (req, res) => {
  try {
    const sessions = (await listSessions())
      .filter((session) => session.userId === String(req.session.userId))
      .map((session) => ({
        handle: session.handle,
        expires: session.expires,
        isCurrent: session.id === req.sessionID,
        userAgent: session.device?.userAgent || "",
        ip: session.device?.ip || "",
        signedInAt: session.device?.signedInAt || null
      }));

    return res.json({ success: true, sessions });
  } catch (error) {
    console.error("Account sessions error:", error);
    return res.status(500).json({ success: false, message: "Unable to load sessions" });
  }
};

// POST /api/account/sessions/sign-out-others
exports.signOutOthers = async (req, res) => {
  try {
    const ended = await deleteOtherSessions(req.session.userId, req.sessionID);
    await recordAuthEvent(req, req.session.userId, "signed_out_others", `${ended} other session(s) ended`);

    return res.json({ success: true, ended });
  } catch (error) {
    console.error("Sign out others error:", error);
    return res.status(500).json({ success: false, message: "Unable to sign out other sessions" });
  }
};

// GET /api/account/storage  (space this user's database takes)
exports.getStorage = async (req, res) => {
  try {
    const database = await describeDatabase(userDbName(req.session.userId));

    return res.json({
      success: true,
      limitBytes: storageLimits().perUserBytes,
      database
    });
  } catch (error) {
    console.error("Account storage error:", error);
    return res.status(500).json({ success: false, message: "Unable to read storage" });
  }
};
