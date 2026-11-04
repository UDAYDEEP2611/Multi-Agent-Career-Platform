const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getPatents,
  createPatent,
  updatePatent,
  deletePatent
} = require("../controllers/patentController");

router.use(requireAuth);

router.get("/", getPatents);
router.post("/", createPatent);
router.patch("/:patentId", updatePatent);
router.delete("/:patentId", deletePatent);

module.exports = router;
