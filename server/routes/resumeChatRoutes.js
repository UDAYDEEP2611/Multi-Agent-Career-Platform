const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { getStatus, sendMessage } = require("../controllers/resumeChatController");

router.use(requireAuth);

router.get("/status", getStatus);
router.post("/:designId", sendMessage);

module.exports = router;
