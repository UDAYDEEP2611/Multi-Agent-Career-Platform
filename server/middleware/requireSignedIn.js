const User = require("../models/User");

// Lets any signed-in, enabled account through (users and admins). Used by
// routes that don't touch portfolio data, like /api/auth/me and logout.
// Sets req.accountRole for later middleware.
const requireSignedIn = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  try {
    const account = await User.findById(req.session.userId).select("role isDisabled passwordChangedAt").lean();

    // An admin may have disabled the account after this session started
    if (account?.isDisabled) {
      return req.session.destroy(() =>
        res.status(403).json({
          success: false,
          message: "This account has been disabled. Contact the site administrator."
        })
      );
    }

    // A password reset signs out sessions started before it (the session
    // store may not be the one deleteSessionsForUser cleans up)
    const signedInAt = Date.parse(req.session.device?.signedInAt);
    if (account?.passwordChangedAt && signedInAt < account.passwordChangedAt.getTime()) {
      return req.session.destroy(() =>
        res.status(401).json({
          success: false,
          message: "Your password was changed. Sign in again."
        })
      );
    }

    req.accountRole = account?.role || "user";
    return next();
  } catch (error) {
    console.error("Sign-in check error:", error);
    return res.status(500).json({ success: false, message: "Unable to check your session" });
  }
};

module.exports = requireSignedIn;
