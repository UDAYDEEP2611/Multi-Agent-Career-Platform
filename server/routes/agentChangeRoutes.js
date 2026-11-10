const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { undoChange } = require("../controllers/agentChangeController");

router.use(requireAuth);

router.post("/undo", undoChange);

module.exports = router;
