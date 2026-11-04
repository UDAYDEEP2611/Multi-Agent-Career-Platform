const express = require("express");
const { rateLimit } = require("express-rate-limit");

const {
  registerUser,
  loginUser,
  getGoogleConfig,
  googleSignIn,
  getCurrentUser,
  logoutUser
} = require("../controllers/authController");

const {
  changePassword,
  forgotPassword,
  checkResetToken,
  resetPassword
} = require("../controllers/passwordResetController");

const requireSignedIn = require("../middleware/requireSignedIn");

const router = express.Router();

const limiter = (minutes, limit, message) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message }
  });

// Reset emails per IP address, so nobody can flood an inbox
const forgotLimiter = limiter(15, 5, "Too many reset requests. Try again in 15 minutes.");
// Guessing a 64-character token is hopeless, but there's no reason to allow many tries
const tokenLimiter = limiter(15, 20, "Too many attempts. Try again in 15 minutes.");
// Connecting Google to an existing account takes its password, so guesses are limited
const googleLimiter = limiter(15, 20, "Too many attempts. Try again in 15 minutes.");
const changeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.session.userId),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many password changes. Try again in 15 minutes." }
});

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/google/config", getGoogleConfig);
router.post("/google", googleLimiter, googleSignIn);

router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password/check", tokenLimiter, checkResetToken);
router.post("/reset-password", tokenLimiter, resetPassword);

router.get("/me", requireSignedIn, getCurrentUser);
router.post("/logout", requireSignedIn, logoutUser);
router.post("/change-password", requireSignedIn, changeLimiter, changePassword);

module.exports = router;
