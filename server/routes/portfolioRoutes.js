const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { getOverview, getShowcase } = require("../controllers/portfolioController");
const {
  generateHeroSummaries,
  saveHeroSummary,
  deleteHeroSummary
} = require("../controllers/heroSummaryController");

router.use(requireAuth);

router.get("/overview", getOverview);
router.get("/showcase", getShowcase);

router.post("/hero-summaries/generate", generateHeroSummaries);
router.put("/hero-summaries/:designId", saveHeroSummary);
router.delete("/hero-summaries/:designId", deleteHeroSummary);
router.delete("/hero-summaries", deleteHeroSummary);

module.exports = router;
