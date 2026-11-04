const express = require("express");
const router = express.Router();

const requireAdmin = require("../middleware/requireAdmin");

const {
  getUsers,
  updateUser,
  getCatalog,
  createCatalogSkill,
  updateCatalogSkill,
  deleteCatalogSkill
} = require("../controllers/adminController");
const {
  getOverview,
  getSessions,
  deleteSession,
  cleanExpiredSessions,
  signOutUser,
  getDatabases,
  deleteOrphanedDatabase,
  deleteUser,
  getSystem,
  clearCache,
  getAudit
} = require("../controllers/adminSystemController");
const { getStorage } = require("../controllers/adminStorageController");

// Admin routes only touch the main database (users, skill catalog)
router.use(requireAdmin);

router.get("/overview", getOverview);

router.get("/users", getUsers);
router.patch("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);
router.post("/users/:userId/sign-out", signOutUser);

router.get("/sessions", getSessions);
router.post("/sessions/clean-expired", cleanExpiredSessions);
router.delete("/sessions/:handle", deleteSession);

router.get("/databases", getDatabases);
router.delete("/databases/:userId", deleteOrphanedDatabase);

router.get("/storage", getStorage);

router.get("/system", getSystem);
router.post("/system/clear-cache", clearCache);

router.get("/audit", getAudit);

router.get("/skill-catalog", getCatalog);
router.post("/skill-catalog", createCatalogSkill);
router.patch("/skill-catalog/:skillId", updateCatalogSkill);
router.delete("/skill-catalog/:skillId", deleteCatalogSkill);

module.exports = router;
