const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");

const {
  getMedia,
  createMedia,
  updateMedia,
  deleteMedia,
  files
} = require("../controllers/educationMediaController");

router.use(requireAuth);

router.get("/", getMedia);
router.post("/", createMedia);
router.patch("/:mediaId", updateMedia);
router.delete("/:mediaId", deleteMedia);

router.post("/:mediaId/file", uploadSingleFile, files.uploadFile);
router.get("/:mediaId/file", files.getFile);
router.delete("/:mediaId/file", files.deleteFile);

module.exports = router;
