import { Router } from 'express';
import { z } from 'zod';

import { getTrendingCourses, getTrendingProfessors } from '../controllers/trending.controller.js';
import { validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const trendingQuery = z
  .object({
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict();

const router = Router();

router.get('/courses', validateQuery(trendingQuery), asyncHandler(getTrendingCourses));
router.get('/professors', validateQuery(trendingQuery), asyncHandler(getTrendingProfessors));

export default router;
