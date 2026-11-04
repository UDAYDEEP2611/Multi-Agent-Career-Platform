const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const educationTaskRoutes = require("./educationTaskRoutes");
const educationSkillRoutes = require("./educationSkillRoutes");
const educationCourseRoutes = require("./educationCourseRoutes");
const educationAchievementRoutes = require("./educationAchievementRoutes");
const educationCertificationRoutes = require("./educationCertificationRoutes");
const educationVolunteeringRoutes = require("./educationVolunteeringRoutes");
const educationMediaRoutes = require("./educationMediaRoutes");
const educationProjectRoutes = require("./educationProjectRoutes");

const {
  getEducations,
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation
} = require("../controllers/educationController");

router.use(requireAuth);

router.use("/:educationId/tasks", educationTaskRoutes);
router.use("/:educationId/skills", educationSkillRoutes);
router.use("/:educationId/courses", educationCourseRoutes);
router.use("/:educationId/achievements", educationAchievementRoutes);
router.use("/:educationId/certifications", educationCertificationRoutes);
router.use("/:educationId/volunteering", educationVolunteeringRoutes);
router.use("/:educationId/media", educationMediaRoutes);
router.use("/:educationId/projects", educationProjectRoutes);

router.get("/", getEducations);
router.get("/:educationId", getEducation);
router.post("/", createEducation);
router.patch("/:educationId", updateEducation);
router.delete("/:educationId", deleteEducation);

module.exports = router;
