const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");
const { fileHandlers } = require("../controllers/experienceFileController");

const {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement
} = require("../controllers/experienceAchievementController");

router.use(requireAuth);

router.get("/", getAchievements);
router.post("/", createAchievement);
router.patch("/:achievementId", updateAchievement);
router.delete("/:achievementId", deleteAchievement);

const files = fileHandlers("achievements", "achievementId", "achievement");

router.post("/:achievementId/file", uploadSingleFile, files.uploadFile);
router.get("/:achievementId/file", files.getFile);
router.delete("/:achievementId/file", files.deleteFile);

module.exports = router;
