const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");
const { educationFileHandlers } = require("../controllers/educationFileController");

// Same handlers as Activities & Achievements, with their own types
const {
  certifications
} = require("../controllers/educationAchievementController");

router.use(requireAuth);

router.get("/", certifications.getAll);
router.post("/", certifications.create);
router.patch("/:certificationId", certifications.update);
router.delete("/:certificationId", certifications.remove);

const files = educationFileHandlers("certifications", "certificationId", "certification");

router.post("/:certificationId/file", uploadSingleFile, files.uploadFile);
router.get("/:certificationId/file", files.getFile);
router.delete("/:certificationId/file", files.deleteFile);

module.exports = router;
