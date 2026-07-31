import rateLimit from 'express-rate-limit';

export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again later.',
      },
    },
  });
}
