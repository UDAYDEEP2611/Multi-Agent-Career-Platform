const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  searchSkills
} = require("../controllers/skillCatalogController");

router.use(requireAuth);

router.get("/search", searchSkills);

module.exports = router;
