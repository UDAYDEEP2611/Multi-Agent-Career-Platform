const mongoose = require("mongoose");

// Every change an admin makes (main database), newest first on the Audit
// Log page. Entries are only ever added.
const adminAuditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminUsername: { type: String, default: "" },
    action: { type: String, required: true },
    target: { type: String, default: "" },
    details: { type: String, default: "" }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "admin_audit_log"
  }
);

adminAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdminAudit", adminAuditSchema);
