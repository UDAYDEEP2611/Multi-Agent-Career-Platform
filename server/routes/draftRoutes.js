const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const { getDrafts, updateDraft, confirmDraft, discardDraft } = require("../controllers/draftController");

router.use(requireAuth);

router.get("/", getDrafts);
router.patch("/:draftId", updateDraft);
router.post("/:draftId/confirm", confirmDraft);
router.delete("/:draftId", discardDraft);

module.exports = router;
