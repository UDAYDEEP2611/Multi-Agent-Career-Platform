const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");
const { educationFileHandlers } = require("../controllers/educationFileController");

const {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement
} = require("../controllers/educationAchievementController");

router.use(requireAuth);

router.get("/", getAchievements);
router.post("/", createAchievement);
router.patch("/:achievementId", updateAchievement);
router.delete("/:achievementId", deleteAchievement);

const files = educationFileHandlers("achievements", "achievementId", "achievement");

router.post("/:achievementId/file", uploadSingleFile, files.uploadFile);
router.get("/:achievementId/file", files.getFile);
router.delete("/:achievementId/file", files.deleteFile);

module.exports = router;
