const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation
} = require("../controllers/recommendationController");

router.use(requireAuth);

router.get("/", getRecommendations);
router.post("/", createRecommendation);
router.patch("/:recommendationId", updateRecommendation);
router.delete("/:recommendationId", deleteRecommendation);

module.exports = router;
