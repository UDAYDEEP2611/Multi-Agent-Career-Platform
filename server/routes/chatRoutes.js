const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { getThread, sendMessage, clearThread, sendFeedback, getModelMetrics } = require("../controllers/chatController");

router.use(requireAuth);

router.get("/", getThread);
router.post("/message", sendMessage);
router.post("/feedback", sendFeedback);
router.get("/model", getModelMetrics);
router.delete("/", clearThread);

module.exports = router;
