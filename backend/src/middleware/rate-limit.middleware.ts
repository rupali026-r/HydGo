import rateLimit from 'express-rate-limit';

/**
 * Auth endpoints: 10 requests per minute per IP
 * Protects against brute-force login / registration spam.
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests — try again later', code: 'RATE_LIMIT' } },
});

/**
 * Public / general API: 60 requests per minute per IP
 */
export const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests — try again later', code: 'RATE_LIMIT' } },
});
