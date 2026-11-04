const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");

const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} = require("../controllers/experienceProjectController");

router.use(requireAuth);

router.get("/", getProjects);
router.get("/:projectId", getProject);
router.post("/", createProject);
router.patch("/:projectId", updateProject);
router.delete("/:projectId", deleteProject);

module.exports = router;
