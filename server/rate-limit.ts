import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Strict limiter for authentication endpoints (login/register) to slow down
 * brute-force and credential-stuffing attacks. ~10 requests / 15 min per IP.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: {
    message: "Too many requests. Please slow down and try again shortly.",
  },
});
