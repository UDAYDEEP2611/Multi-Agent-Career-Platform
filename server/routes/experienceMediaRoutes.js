const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");
const { fileHandlers } = require("../controllers/experienceFileController");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");

const {
  getMedia,
  createMedia,
  updateMedia,
  deleteMedia
} = require("../controllers/experienceMediaController");

router.use(requireAuth);

router.get("/", getMedia);
router.post("/", createMedia);
router.patch("/:mediaId", updateMedia);
router.delete("/:mediaId", deleteMedia);

const files = fileHandlers("media", "mediaId", "media");

router.post("/:mediaId/file", uploadSingleFile, files.uploadFile);
router.get("/:mediaId/file", files.getFile);
router.delete("/:mediaId/file", files.deleteFile);

module.exports = router;
