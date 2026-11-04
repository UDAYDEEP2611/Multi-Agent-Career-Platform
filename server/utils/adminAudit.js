const AdminAudit = require("../models/AdminAudit");

// Records an admin action. A failure to log never fails the action itself.
async function logAdminAction(req, action, target = "", details = "") {
  try {
    await AdminAudit.create({
      adminId: req.session.userId,
      adminUsername: req.adminUser?.username || "",
      action,
      target,
      details
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

module.exports = { logAdminAction };
