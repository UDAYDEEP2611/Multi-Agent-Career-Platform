const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");

const {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill
} = require("../controllers/educationSkillController");

router.use(requireAuth);

router.get("/", getSkills);
router.post("/", createSkill);
router.patch("/:skillId", updateSkill);
router.delete("/:skillId", deleteSkill);

module.exports = router;
