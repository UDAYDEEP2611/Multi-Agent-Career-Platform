const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getAssociations,
  getSourceSkills,
  createAssociation,
  deleteAssociation
} = require("../controllers/skillAssociationController");

router.use(requireAuth);

router.get("/skill/:skillId", getAssociations);
router.get("/source/:sourceType/:sourceId", getSourceSkills);
router.post("/", createAssociation);
router.delete("/:associationId", deleteAssociation);

module.exports = router;
