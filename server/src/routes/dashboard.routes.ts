import { Router } from 'express';
import { z } from 'zod';

import { getActivity, getStats, getUpcoming } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const activityQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

const router = Router();

router.get('/stats', requireAuth, asyncHandler(getStats));
router.get('/upcoming', requireAuth, asyncHandler(getUpcoming));
router.get('/activity', requireAuth, validateQuery(activityQuery), asyncHandler(getActivity));

export default router;
