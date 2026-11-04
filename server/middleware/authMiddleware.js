const requireSignedIn = require("./requireSignedIn");
const { prepareUserDatabase, runAsUser } = require("../utils/userDatabase");
const { trackChanges } = require("../utils/activityLog");
require("../models/userModels");

// Portfolio routes: signed-in regular users only. The rest of the request
// runs against the user's own database. Admin accounts have no portfolio;
// they only use the admin console.
const requireAuth = (req, res, next) =>
  requireSignedIn(req, res, async () => {
    if (req.accountRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts don't have a portfolio. Use the admin console."
      });
    }

    try {
      await prepareUserDatabase(req.session.userId);
    } catch (error) {
      console.error("User database error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to open your data. Please try again."
      });
    }

    // Records successful creates, updates and deletes in the user's log
    trackChanges(req, res);

    return runAsUser(req.session.userId, next);
  });

module.exports = requireAuth;
