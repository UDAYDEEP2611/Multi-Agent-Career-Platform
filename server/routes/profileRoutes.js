
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");

const {
  getProfile,
  createProfile,
  updateContact,
  updatePersonal,
  updateRoleDetails,
  deleteProfile
} = require("../controllers/profileController");

router.use(requireAuth);

router.get("/", getProfile);
router.post("/", createProfile);
router.patch("/contact", updateContact);
router.patch("/personal", updatePersonal);
router.patch("/roles", updateRoleDetails);
router.delete("/", deleteProfile);

module.exports = router;
