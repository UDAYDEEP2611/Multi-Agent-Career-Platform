const express = require("express");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();

const requireAuth = require("../middleware/authMiddleware");
const {
  requireUnlocked,
  getLock,
  unlock,
  lock,
  getActivity,
  getSessions,
  signOutOthers,
  getStorage
} = require("../controllers/accountController");

// Password guesses on the lock screen are limited per user
const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.session.userId),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: "Too many attempts. Try again in 15 minutes." }
});

router.use(requireAuth);

router.get("/lock", getLock);
router.post("/unlock", unlockLimiter, unlock);
router.post("/lock", lock);

// Everything below needs the log to be unlocked
router.get("/activity", requireUnlocked, getActivity);
router.get("/sessions", requireUnlocked, getSessions);
router.post("/sessions/sign-out-others", requireUnlocked, signOutOthers);
router.get("/storage", requireUnlocked, getStorage);

module.exports = router;
