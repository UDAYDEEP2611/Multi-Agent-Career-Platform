const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");
const { fileHandlers } = require("../controllers/experienceFileController");

const {
  getVolunteering,
  createVolunteering,
  updateVolunteering,
  deleteVolunteering
} = require("../controllers/experienceVolunteeringController");

router.use(requireAuth);

router.get("/", getVolunteering);
router.post("/", createVolunteering);
router.patch("/:volunteeringId", updateVolunteering);
router.delete("/:volunteeringId", deleteVolunteering);

const files = fileHandlers("volunteering", "volunteeringId", "volunteering");

router.post("/:volunteeringId/file", uploadSingleFile, files.uploadFile);
router.get("/:volunteeringId/file", files.getFile);
router.delete("/:volunteeringId/file", files.deleteFile);

module.exports = router;
