
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { prepareUserDatabase } = require("../utils/userDatabase");
const { recordAuthEvent } = require("../utils/activityLog");
const { maxUsers } = require("../utils/projectLimits");
const { googleClientId, verifyGoogleCredential } = require("../services/googleAuth");

const fullMessage = () =>
  `This site is limited to ${maxUsers()} accounts and is full. Contact the site administrator.`;
require("../models/userModels");

// Two sign-ups at the same moment can both pass the limit check; the newest
// accounts past the limit are removed again
const removedOverLimit = async (user) => {
  const overLimit = await User.find({}, { _id: 1 })
    .sort({ createdAt: 1, _id: 1 })
    .skip(maxUsers())
    .lean();

  if (!overLimit.some((extra) => String(extra._id) === String(user._id))) return false;
  await user.deleteOne();
  return true;
};

// Each user gets their own database for their portfolio data. If this fails
// it is retried on their first signed-in request.
const prepareDatabase = async (user) => {
  try {
    await prepareUserDatabase(user._id);
  } catch (error) {
    console.error("User database setup error:", error);
  }
};

const registerUser = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-30 characters: letters, numbers or underscores"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (password.length < 12 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 12 and 72 characters"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match"
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username or email is already registered"
      });
    }

    if ((await User.countDocuments()) >= maxUsers()) {
      return res.status(403).json({ success: false, message: fullMessage() });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      authProviders: ["local"],
      isEmailVerified: false
    });

    if (await removedOverLimit(user)) {
      return res.status(403).json({ success: false, message: fullMessage() });
    }

    await prepareDatabase(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username or email is already registered"
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create account"
    });
  }
};

// Signs this browser in to the account and sends the reply
const startSession = (req, res, user, { status = 200, label = "" } = {}) => {
  // Regenerate the session to prevent session fixation
  req.session.regenerate((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to create login session"
      });
    }

    req.session.userId = user._id.toString();
    // Shown in the user's own session list
    req.session.device = {
      userAgent: String(req.get("user-agent") || "").slice(0, 300),
      ip: String(req.ip || "").slice(0, 64),
      signedInAt: new Date().toISOString()
    };

    req.session.save(async (saveError) => {
      if (saveError) {
        return res.status(500).json({
          success: false,
          message: "Unable to save login session"
        });
      }

      try {
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } }
        );
      } catch (updateError) {
        console.error("Last login update failed:", updateError);
      }

      if (user.role !== "admin") await recordAuthEvent(req, user._id, "signed_in", label);

      return res.status(status).json({
        success: true,
        message: "Login successful",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    });
  });
};

const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (
      typeof identifier !== "string" ||
      typeof password !== "string" ||
      !identifier.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username/email and password are required"
      });
    }

    const loginIdentifier = identifier.trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { username: loginIdentifier },
        { email: loginIdentifier }
      ]
    }).select("+passwordHash");

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      // Shown to the account owner in their activity log
      if (user.role !== "admin") await recordAuthEvent(req, user._id, "sign_in_failed");

      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        success: false,
        message: "This account has been disabled. Contact the site administrator."
      });
    }

    return startSession(req, res, user);
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login"
    });
  }
};

// A username from the email address, with a suffix if it's taken
const newUsername = async (email) => {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  const start = base.length >= 3 ? base : `user_${base}`.replace(/_$/, "");

  if (!(await User.exists({ username: start }))) return start;
  for (let tries = 0; tries < 20; tries += 1) {
    const candidate = `${start}_${crypto.randomBytes(2).toString("hex")}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  throw new Error("No free username");
};

const disabledReply = (res) => res.status(403).json({
  success: false,
  message: "This account has been disabled. Contact the site administrator."
});

// GET /api/auth/google/config: the button only shows when Google is set up
const getGoogleConfig = (req, res) =>
  res.json({ success: true, clientId: googleClientId() });

// POST /api/auth/google  { credential, password? }
// Signs in with a Google ID token, creating the account the first time. An
// email that already has a password account needs that password once: anyone
// can register an address they don't own, so a matching email alone doesn't
// prove the account belongs to the person signing in.
const googleSignIn = async (req, res) => {
  try {
    if (!googleClientId()) {
      return res.status(503).json({ success: false, message: "Google sign-in isn't set up on this site" });
    }

    const google = await verifyGoogleCredential(req.body?.credential);
    if (!google) {
      return res.status(401).json({ success: false, message: "Google sign-in failed. Please try again." });
    }

    const linked = await User.findOne({ googleId: google.googleId });
    if (linked) {
      if (linked.isDisabled) return disabledReply(res);
      return startSession(req, res, linked, { label: "With Google" });
    }

    if (!google.email || !google.emailVerified) {
      return res.status(403).json({ success: false, message: "Your Google account's email isn't verified" });
    }

    const existing = await User.findOne({ email: google.email }).select("+passwordHash");

    if (existing) {
      if (existing.isDisabled) return disabledReply(res);

      if (existing.googleId) {
        return res.status(409).json({ success: false, message: "This email is already connected to a different Google account" });
      }

      if (!existing.passwordHash) {
        return res.status(409).json({ success: false, message: "Reset this account's password first, then connect Google" });
      }

      const { password } = req.body;
      if (typeof password !== "string" || !password) {
        return res.status(409).json({
          success: false,
          needsPassword: true,
          email: existing.email,
          message: "An account already uses this email. Enter its password to connect Google."
        });
      }

      if (!(await bcrypt.compare(password, existing.passwordHash))) {
        if (existing.role !== "admin") await recordAuthEvent(req, existing._id, "sign_in_failed", "Wrong password while connecting Google");
        return res.status(401).json({ success: false, needsPassword: true, email: existing.email, message: "Incorrect password" });
      }

      existing.googleId = google.googleId;
      existing.isEmailVerified = true;
      existing.authProviders = [...new Set([...existing.authProviders, "google"])];
      await existing.save();

      return startSession(req, res, existing, { label: "Connected Google" });
    }

    if ((await User.countDocuments()) >= maxUsers()) {
      return res.status(403).json({ success: false, message: fullMessage() });
    }

    const user = await User.create({
      username: await newUsername(google.email),
      email: google.email,
      googleId: google.googleId,
      authProviders: ["google"],
      isEmailVerified: true
    });

    if (await removedOverLimit(user)) {
      return res.status(403).json({ success: false, message: fullMessage() });
    }

    await prepareDatabase(user);

    return startSession(req, res, user, { status: 201, label: "With Google" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Google sign-in was already in progress. Please try again." });
    }

    console.error("Google sign-in error:", error);

    return res.status(500).json({ success: false, message: "Unable to sign in with Google" });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select("username email authProviders isEmailVerified createdAt role");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        authProviders: user.authProviders,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user"
    });
  }
};

const logoutUser = async (req, res) => {
  if (req.accountRole !== "admin") {
    await recordAuthEvent(req, req.session.userId, "signed_out");
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to logout"
      });
    }

    res.clearCookie("portfolio.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production"
        ? "none"
        : "lax",
      path: "/"
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  });
};
module.exports = {
  registerUser,
  loginUser,
  getGoogleConfig,
  googleSignIn,
  getCurrentUser,
  logoutUser
};