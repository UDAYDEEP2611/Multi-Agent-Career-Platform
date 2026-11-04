const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getExperiences,
  getExperience,
  createExperience,
  updateExperience,
  deleteExperience
} = require("../controllers/experienceController");

router.use(requireAuth);

router.get("/", getExperiences);
router.post("/", createExperience);
router.get("/:experienceId", getExperience);
router.patch("/:experienceId", updateExperience);
router.delete("/:experienceId", deleteExperience);

module.exports = router;
