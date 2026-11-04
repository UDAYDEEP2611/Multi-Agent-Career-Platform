const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

// Media reuses the project media routes and controller
// (see controllers/projectAccess.js)
const mediaRoutes = require("./experienceProjectMediaRoutes");

const {
  getAchievements,
  getAchievement,
  createAchievement,
  updateAchievement,
  deleteAchievement
} = require("../controllers/achievementController");

router.use(requireAuth);

router.use("/:activityId/media", mediaRoutes);

router.get("/", getAchievements);
router.get("/:activityId", getAchievement);
router.post("/", createAchievement);
router.patch("/:activityId", updateAchievement);
router.delete("/:activityId", deleteAchievement);

module.exports = router;
