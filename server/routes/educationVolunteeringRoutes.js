const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");
const { educationFileHandlers } = require("../controllers/educationFileController");

const {
  getVolunteering,
  createVolunteering,
  updateVolunteering,
  deleteVolunteering
} = require("../controllers/educationVolunteeringController");

router.use(requireAuth);

router.get("/", getVolunteering);
router.post("/", createVolunteering);
router.patch("/:volunteeringId", updateVolunteering);
router.delete("/:volunteeringId", deleteVolunteering);

const files = educationFileHandlers("volunteering", "volunteeringId", "volunteering");

router.post("/:volunteeringId/file", uploadSingleFile, files.uploadFile);
router.get("/:volunteeringId/file", files.getFile);
router.delete("/:volunteeringId/file", files.deleteFile);

module.exports = router;
