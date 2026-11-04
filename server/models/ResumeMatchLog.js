const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// The JobPilot log book: each uploaded resume, the job it was compared
// with, and the results. MongoDB deletes each entry 72 hours after it was
// made (a TTL index), so the log clears itself.

const LOG_LIFETIME_SECONDS = 72 * 60 * 60;

const resumeMatchLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    fileName: { type: String, required: true, trim: true, maxlength: 200 },
    fileType: { type: String, required: true, enum: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/rtf", "text/plain"] },
    // The uploaded file, for Preview; never sent with the list
    file: { type: Buffer, required: true, select: false },
    // The text read from it, to preview files a browser can't show (DOCX, RTF)
    text: { type: String, default: "", select: false },
    // URLs behind clickable text in the file ("LinkedIn" that opens the profile)
    links: { type: [{ _id: false, url: String, text: String }], default: [], select: false },
    jobDescription: { type: String, required: true, maxlength: 8000 },
    jobTitle: { type: String, default: "", maxlength: 120 },
    company: { type: String, default: "", maxlength: 80 },
    candidateName: { type: String, default: "", maxlength: 120 },
    overall: { type: Number, min: 0, max: 100 },
    atsScore: { type: Number, min: 0, max: 100 },
    // { match, ats, recommendations, found, notes, aiUsed }
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    // The candidate's answers about inferred skills: { "git": "yes", "team collaboration": "no" }
    confirmations: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: "resume_match_logs" }
);

resumeMatchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: LOG_LIFETIME_SECONDS });
resumeMatchLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = userModel("ResumeMatchLog", resumeMatchLogSchema);
module.exports.LOG_LIFETIME_SECONDS = LOG_LIFETIME_SECONDS;
module.exports.resumeMatchLogSchema = resumeMatchLogSchema;
