const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

// Media reuses the project media routes and controller
// (see controllers/projectAccess.js)
const mediaRoutes = require("./experienceProjectMediaRoutes");

const {
  getCertifications,
  getCertification,
  createCertification,
  updateCertification,
  deleteCertification
} = require("../controllers/certificationController");

router.use(requireAuth);

router.use("/:certificationId/media", mediaRoutes);

router.get("/", getCertifications);
router.get("/:certificationId", getCertification);
router.post("/", createCertification);
router.patch("/:certificationId", updateCertification);
router.delete("/:certificationId", deleteCertification);

module.exports = router;
