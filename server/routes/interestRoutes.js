const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getInterests,
  createInterest,
  updateInterest,
  deleteInterest
} = require("../controllers/interestController");

router.use(requireAuth);

router.get("/", getInterests);
router.post("/", createInterest);
router.patch("/:interestId", updateInterest);
router.delete("/:interestId", deleteInterest);

module.exports = router;
