
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const {
  getSummary,
  createSummary,
  updateSummary,
  deleteSummary,
  restoreSummary,
  deleteHistoryEntry,
  reviewSummary,
  generateSummaries
} = require("../controllers/summaryController");

router.use(requireAuth);

router.get("/", getSummary);
router.post("/", createSummary);
router.put("/", updateSummary);
router.delete("/", deleteSummary);
router.post("/generate", generateSummaries);
router.post("/review", reviewSummary);
router.post("/history/:historyId/restore", restoreSummary);
router.delete("/history/:historyId", deleteHistoryEntry);

module.exports = router;
