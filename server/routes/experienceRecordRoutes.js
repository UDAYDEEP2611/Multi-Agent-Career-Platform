const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");
const { uploadSingleFile } = require("../middleware/uploadMiddleware");
const { fileHandlers } = require("../controllers/experienceFileController");

const {
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord
} = require("../controllers/experienceRecordController");

router.use(requireAuth);

router.get("/", getRecords);
router.post("/", createRecord);
router.patch("/:recordId", updateRecord);
router.delete("/:recordId", deleteRecord);

const files = fileHandlers("records", "recordId", "record");

router.post("/:recordId/file", uploadSingleFile, files.uploadFile);
router.get("/:recordId/file", files.getFile);
router.delete("/:recordId/file", files.deleteFile);

module.exports = router;
