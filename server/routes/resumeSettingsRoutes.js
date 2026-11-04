const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { getSettings, updateSettings } = require("../controllers/resumeSettingsController");

router.use(requireAuth);

router.get("/", getSettings);
router.patch("/", updateSettings);

module.exports = router;
