const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { sendMail, buttonEmail } = require("../services/mailer");
const { recordAuthEvent } = require("../utils/activityLog");
const { deleteSessionsForUser, deleteOtherSessions } = require("../utils/sessionRecords");

// Forgotten passwords: the emailed reset link carries a random token; only
// its SHA-256 hash is stored, and it works once until it expires.
// Signed-in users can also set a new password directly.

const RESET_MINUTES = 60;

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const newToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashToken(token) };
};

const isToken = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const clientLink = (path, token) =>
  `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}${path}?token=${token}`;

const passwordProblem = (password, confirmPassword) => {
  if (typeof password !== "string" || typeof confirmPassword !== "string" || !password) {
    return "Enter and confirm your new password";
  }
  if (password.length < 12 || password.length > 72) {
    return "Password must be between 12 and 72 characters";
  }
  if (password !== confirmPassword) return "Passwords do not match";
  return null;
};

const invalidLink = (res, message) => res.status(400).json({ success: false, message });

// POST /api/auth/forgot-password  { email }
// The reply is the same whether or not the email belongs to an account, so
// it can't be used to find out who has signed up.
const forgotPassword = async (req, res) => {
  const { email } = req.body || {};

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, message: "Enter a valid email address" });
  }

  const reply = () => res.json({
    success: true,
    message: "If an account uses that email, we've sent a link to reset the password. Check your inbox and spam folder."
  });

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("username email role isDisabled");

    if (!user || user.isDisabled) return reply();

    const { token, hash } = newToken();

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordTokenHash: hash,
          resetPasswordExpiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000)
        }
      }
    );

    // Not awaited: a slow mail server shouldn't make known emails reply
    // slower than unknown ones
    sendMail({
      to: user.email,
      subject: "Reset your password",
      ...buttonEmail({
        greeting: `Hi ${user.username},`,
        intro: "We received a request to reset the password for your UltraUnityVerse account.",
        buttonLabel: "Reset password",
        link: clientLink("/reset-password", token),
        outro: `This link expires in ${RESET_MINUTES} minutes and can be used once. If you didn't ask for this, ignore this email; your password won't change.`
      })
    }).catch((error) => console.error("Reset email error:", error));

    if (user.role !== "admin") await recordAuthEvent(req, user._id, "password_reset_requested");

    return reply();
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Unable to start the password reset" });
  }
};

const resetFailed = "This reset link is invalid or has expired. Request a new one.";

// POST /api/auth/reset-password/check  { token }
// Lets the reset page say the link is dead before the user types a password
const checkResetToken = async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!isToken(token)) return invalidLink(res, resetFailed);

    const exists = await User.exists({
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpiresAt: { $gt: new Date() }
    });

    if (!exists) return invalidLink(res, resetFailed);
    return res.json({ success: true });
  } catch (error) {
    console.error("Check reset token error:", error);
    return res.status(500).json({ success: false, message: "Unable to check the reset link" });
  }
};

// POST /api/auth/reset-password  { token, password, confirmPassword }
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (!isToken(token)) return invalidLink(res, resetFailed);

    const problem = passwordProblem(password, confirmPassword);
    if (problem) return res.status(400).json({ success: false, message: problem });

    const passwordHash = await bcrypt.hash(password, 12);

    // Matching on the token and clearing it in one update means a link can
    // only be used once, even by two requests at the same moment
    const user = await User.findOneAndUpdate(
      {
        resetPasswordTokenHash: hashToken(token),
        resetPasswordExpiresAt: { $gt: new Date() },
        isDisabled: { $ne: true }
      },
      {
        $set: {
          passwordHash,
          passwordChangedAt: new Date(),
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null
        },
        $addToSet: { authProviders: "local" }
      },
      { returnDocument: "after" }
    );

    if (!user) return invalidLink(res, resetFailed);

    // Anyone signed in with the old password is signed out
    try {
      await deleteSessionsForUser(user._id);
    } catch (error) {
      console.error("Session cleanup after reset failed:", error);
    }

    if (user.role !== "admin") await recordAuthEvent(req, user._id, "password_reset");

    return res.json({ success: true, message: "Your password has been reset. Sign in with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Unable to reset your password" });
  }
};

// POST /api/auth/change-password  { password, confirmPassword }  (signed in)
// This device stays signed in; every other session is signed out.
const changePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body || {};

    const problem = passwordProblem(password, confirmPassword);
    if (problem) return res.status(400).json({ success: false, message: problem });

    const passwordHash = await bcrypt.hash(password, 12);
    const changedAt = new Date();

    const user = await User.findByIdAndUpdate(
      req.session.userId,
      {
        $set: { passwordHash, passwordChangedAt: changedAt, resetPasswordTokenHash: null, resetPasswordExpiresAt: null },
        $addToSet: { authProviders: "local" }
      },
      { returnDocument: "after" }
    );

    if (!user) return res.status(401).json({ success: false, message: "User no longer exists" });

    // Sessions started before passwordChangedAt stop working
    // (middleware/requireSignedIn.js), so this one counts as started now
    req.session.device = { ...req.session.device, signedInAt: changedAt.toISOString() };

    try {
      await deleteOtherSessions(user._id, req.sessionID);
    } catch (error) {
      console.error("Session cleanup after password change failed:", error);
    }

    if (user.role !== "admin") await recordAuthEvent(req, user._id, "password_changed");

    return req.session.save((error) => {
      if (error) console.error("Session save after password change failed:", error);
      return res.json({ success: true, message: "Your password has been changed. Other devices were signed out." });
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Unable to change your password" });
  }
};

module.exports = {
  changePassword,
  forgotPassword,
  checkResetToken,
  resetPassword
};
