import { Router } from 'express';
import { z } from 'zod';

import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createAuthRateLimiter } from '../middleware/rate-limit.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const email = z.string().trim().email().max(320);
const password = z.string().min(8).max(128);

const registerBody = z
  .object({
    email,
    password,
    confirmPassword: password,
  })
  .strict();

const loginBody = z.object({ email, password }).strict();
const refreshBody = z.object({ refreshToken: z.string().min(1) }).strict();
const forgotPasswordBody = z.object({ email }).strict();
const resetPasswordBody = z
  .object({
    tokenHash: z.string().min(1),
    password,
    confirmPassword: password,
  })
  .strict();

const router = Router();

router.post(
  '/register',
  createAuthRateLimiter(),
  validateBody(registerBody),
  asyncHandler(register),
);
router.post('/login', createAuthRateLimiter(), validateBody(loginBody), asyncHandler(login));
router.post('/logout', requireAuth, asyncHandler(logout));
router.post('/refresh', validateBody(refreshBody), asyncHandler(refresh));
router.post('/forgot-password', validateBody(forgotPasswordBody), asyncHandler(forgotPassword));
router.post('/reset-password', validateBody(resetPasswordBody), asyncHandler(resetPassword));
router.get('/me', requireAuth, asyncHandler(me));

export default router;
