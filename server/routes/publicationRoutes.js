const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getPublications,
  createPublication,
  updatePublication,
  deletePublication
} = require("../controllers/publicationController");

router.use(requireAuth);

router.get("/", getPublications);
router.post("/", createPublication);
router.patch("/:publicationId", updatePublication);
router.delete("/:publicationId", deletePublication);

module.exports = router;
