const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { updateVisibility } = require("../controllers/visibilityController");

router.use(requireAuth);

router.patch("/:section/:id", updateVisibility);

module.exports = router;
