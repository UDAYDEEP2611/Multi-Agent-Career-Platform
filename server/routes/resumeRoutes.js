const express = require("express");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const {
  getSources, generateResume, reviseResume, recalculateMatch, fitSummary, compareResume,
  listMatchLogs, getMatchLog, getMatchLogFile, deleteMatchLog, confirmMatchLog, jobInfo
} = require("../controllers/resumeController");
const { uploadResumeFile } = require("../middleware/uploadMiddleware");

// Each resume can mean many calls to the local model
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  keyGenerator: (req) => String(req.session.userId),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "You've built several resumes already. Try again in 15 minutes." }
});

// Fitting the summary to its lines takes up to 3 model calls per layout
const fitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => String(req.session.userId),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "The summary was rephrased many times already. Try again in 15 minutes." }
});

// Comparing an uploaded resume: at most 2 model calls each
const compareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.session.userId),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "You've compared many resumes already. Try again in 15 minutes." }
});

router.use(requireAuth);

router.get("/sources", getSources);
router.post("/generate", generateLimiter, generateResume);
router.post("/revise", generateLimiter, reviseResume);
router.post("/match", recalculateMatch);
router.post("/summary-fit", fitLimiter, fitSummary);
router.post("/compare", compareLimiter, uploadResumeFile, compareResume);
router.post("/job-info", fitLimiter, jobInfo);
// The JobPilot log book (entries last 72 hours)
router.get("/match-logs", listMatchLogs);
router.get("/match-logs/:id", getMatchLog);
router.get("/match-logs/:id/file", getMatchLogFile);
router.delete("/match-logs/:id", deleteMatchLog);
router.post("/match-logs/:id/confirm", fitLimiter, confirmMatchLog);

module.exports = router;
