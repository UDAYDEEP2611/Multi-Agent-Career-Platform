
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { prepareUserDatabase } = require("../utils/userDatabase");
const { recordAuthEvent } = require("../utils/activityLog");
const { maxUsers } = require("../utils/projectLimits");

const fullMessage = () =>
  `This site is limited to ${maxUsers()} accounts and is full. Contact the site administrator.`;
require("../models/userModels");

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

    // Two sign-ups at the same moment can both pass the check above; the
    // newest accounts past the limit are removed again
    const overLimit = await User.find({}, { _id: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .skip(maxUsers())
      .lean();

    if (overLimit.some((extra) => String(extra._id) === String(user._id))) {
      await user.deleteOne();
      return res.status(403).json({ success: false, message: fullMessage() });
    }

    // Each user gets their own database for their portfolio data. If this
    // fails it is retried on their first signed-in request.
    try {
      await prepareUserDatabase(user._id);
    } catch (error) {
      console.error("User database setup error:", error);
    }

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

        if (user.role !== "admin") await recordAuthEvent(req, user._id, "signed_in");

        return res.status(200).json({
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

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to login"
    });
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
  getCurrentUser,
  logoutUser
};