const express = require("express");

const router = express.Router({
  mergeParams: true
});

const requireAuth = require("../middleware/authMiddleware");

// Project sections share their routes and controllers with Experience
// projects (see controllers/projectAccess.js)
const projectTaskRoutes = require("./experienceProjectTaskRoutes");
const projectContributorRoutes = require("./experienceProjectContributorRoutes");
const projectSkillRoutes = require("./experienceProjectSkillRoutes");
const projectMediaRoutes = require("./experienceProjectMediaRoutes");

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} = require("../controllers/educationProjectController");

router.use(requireAuth);

router.use("/:projectId/tasks", projectTaskRoutes);
router.use("/:projectId/contributors", projectContributorRoutes);
router.use("/:projectId/skills", projectSkillRoutes);
router.use("/:projectId/media", projectMediaRoutes);

router.get("/", getProjects);
router.get("/:projectId", getProject);
router.post("/", createProject);
router.patch("/:projectId", updateProject);
router.delete("/:projectId", deleteProject);

module.exports = router;
