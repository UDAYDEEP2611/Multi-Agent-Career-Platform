const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// A user's own activity log, stored in their database:
//   kind "data": something in their portfolio was created, updated or deleted
//   kind "auth": a sign-in, sign-out, failed attempt or unlock of the log
// Entries are kept for a year.
const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    kind: { type: String, enum: ["data", "auth"], required: true },
    // data: created | updated | deleted | reordered | uploaded
    // auth: signed_in | sign_in_failed | signed_out | unlocked | unlock_failed | signed_out_by_admin | ...
    action: { type: String, required: true, maxlength: 50 },
    section: { type: String, default: "", maxlength: 120 },
    label: { type: String, default: "", maxlength: 200 },
    method: { type: String, default: "" },
    path: { type: String, default: "", maxlength: 300 },
    ip: { type: String, default: "", maxlength: 64 },
    userAgent: { type: String, default: "", maxlength: 300 }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "activity_log"
  }
);

activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
activityLogSchema.index({ kind: 1, createdAt: -1 });

module.exports = userModel("ActivityLog", activityLogSchema);
