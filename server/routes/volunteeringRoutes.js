const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

// Media reuses the project media routes and controller
// (see controllers/projectAccess.js)
const mediaRoutes = require("./experienceProjectMediaRoutes");

const {
  getVolunteering,
  getVolunteeringRole,
  createVolunteering,
  updateVolunteering,
  deleteVolunteering
} = require("../controllers/volunteeringController");

router.use(requireAuth);

router.use("/:volunteeringId/media", mediaRoutes);

router.get("/", getVolunteering);
router.get("/:volunteeringId", getVolunteeringRole);
router.post("/", createVolunteering);
router.patch("/:volunteeringId", updateVolunteering);
router.delete("/:volunteeringId", deleteVolunteering);

module.exports = router;
