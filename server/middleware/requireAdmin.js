const User = require("../models/User");

// Lets only signed-in, enabled admins through. The role is read from the
// database on every request, so removing it takes effect immediately.
const requireAdmin = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const user = await User.findById(req.session.userId).select("role isDisabled username");

    if (!user || user.isDisabled || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    req.adminUser = user;
    return next();
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({ success: false, message: "Unable to check access" });
  }
};

module.exports = requireAdmin;
