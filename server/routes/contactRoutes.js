const express = require("express");
const { rateLimit } = require("express-rate-limit");

const { sendContactMessage, subscribe } = require("../controllers/contactController");

const router = express.Router();

// Messages per IP address, so nobody can flood the inbox. A form with a mistake
// in it doesn't use up a try.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  skipFailedRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many messages. Try again in an hour." }
});

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  skipFailedRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many tries. Try again in an hour." }
});

router.post("/", contactLimiter, sendContactMessage);
router.post("/subscribe", subscribeLimiter, subscribe);

module.exports = router;
