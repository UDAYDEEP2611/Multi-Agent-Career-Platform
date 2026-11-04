const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");
const { uploadDocumentFile } = require("../middleware/uploadMiddleware");

const {
  getMedia,
  createLink,
  uploadFile,
  updateMedia,
  downloadFile,
  deleteMedia
} = require("../controllers/experienceProjectMediaController");

router.use(requireAuth);

router.get("/", getMedia);
router.post("/links", createLink);
router.post("/upload", uploadDocumentFile, uploadFile);

router.get("/:mediaId/download", downloadFile);
router.patch("/:mediaId", updateMedia);
router.delete("/:mediaId", deleteMedia);

module.exports = router;
