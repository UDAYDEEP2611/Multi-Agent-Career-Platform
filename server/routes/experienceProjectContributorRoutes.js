const express = require("express");
const router = express.Router({ mergeParams: true });

const requireAuth = require("../middleware/authMiddleware");

const {
  getContributors,
  createContributor,
  updateContributor,
  deleteContributor
} = require("../controllers/experienceProjectContributorController");

router.use(requireAuth);

router.get("/", getContributors);
router.post("/", createContributor);
router.patch("/:contributorId", updateContributor);
router.delete("/:contributorId", deleteContributor);

module.exports = router;
