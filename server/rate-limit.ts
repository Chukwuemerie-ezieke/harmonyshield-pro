import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Disable rate limiting under the test runner so the integration suite can make
// many auth/API calls from the same (loopback) IP without tripping the limiter.
// This never affects dev or production, where NODE_ENV is not "test".
const skipInTest = () => process.env.NODE_ENV === "test";

/**
 * Strict limiter for authentication endpoints (login/register) to slow down
 * brute-force and credential-stuffing attacks. ~10 requests / 15 min per IP.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

/**
 * Looser global limiter applied to the whole /api surface to protect against
 * abusive traffic while leaving normal usage unaffected. ~300 req / 15 min per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    message: "Too many requests. Please slow down and try again shortly.",
  },
});
