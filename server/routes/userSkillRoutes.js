const express = require("express");
const router = express.Router();

const { rateLimit } = require("express-rate-limit");
const requireAuth = require("../middleware/authMiddleware");

// The check may call the Claude API, so it is limited per user
const checkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.session.userId),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many skill checks. Wait a minute and try again." }
});

const {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  reorderSkills,
  checkSkill
} = require("../controllers/userSkillController");

router.use(requireAuth);

router.get("/", getSkills);
router.post("/", createSkill);
router.post("/check", checkLimiter, checkSkill);
router.put("/order", reorderSkills);
router.patch("/:skillId", updateSkill);
router.delete("/:skillId", deleteSkill);

module.exports = router;
