const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const {
  getCustomDesigns,
  getCustomDesign,
  createCustomDesign,
  updateCustomDesign,
  deleteCustomDesign
} = require("../controllers/customDesignController");

router.use(requireAuth);

router.get("/", getCustomDesigns);
router.post("/", createCustomDesign);
router.get("/:designId", getCustomDesign);
router.patch("/:designId", updateCustomDesign);
router.delete("/:designId", deleteCustomDesign);

module.exports = router;
