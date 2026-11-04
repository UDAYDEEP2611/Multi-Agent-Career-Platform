const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

// Tasks, contributors and media reuse the Experience project routes and
// controllers (see controllers/projectAccess.js)
const projectTaskRoutes = require("./experienceProjectTaskRoutes");
const projectContributorRoutes = require("./experienceProjectContributorRoutes");
const projectMediaRoutes = require("./experienceProjectMediaRoutes");

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} = require("../controllers/projectController");
const {
  achievements,
  links
} = require("../controllers/projectSectionController");

// Routes for one list inside a project
function sectionRouter(controller, idParam) {
  const section = express.Router({ mergeParams: true });

  section.get("/", controller.getAll);
  section.post("/", controller.create);
  section.patch(`/:${idParam}`, controller.update);
  section.delete(`/:${idParam}`, controller.remove);

  return section;
}

router.use(requireAuth);

router.use("/:projectId/tasks", projectTaskRoutes);
router.use("/:projectId/contributors", projectContributorRoutes);
router.use("/:projectId/media", projectMediaRoutes);
router.use("/:projectId/achievements", sectionRouter(achievements, "achievementId"));
router.use("/:projectId/links", sectionRouter(links, "linkId"));

router.get("/", getProjects);
router.get("/:projectId", getProject);
router.post("/", createProject);
router.patch("/:projectId", updateProject);
router.delete("/:projectId", deleteProject);

module.exports = router;
