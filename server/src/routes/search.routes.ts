import { Router } from 'express';
import { z } from 'zod';

import { search } from '../controllers/search.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const searchQuery = z
  .object({
    q: z.string().trim().min(1).max(100),
    limit: z.coerce.number().int().positive().max(20).optional(),
  })
  .strict();

const router = Router();

router.get('/', requireAuth, validateQuery(searchQuery), asyncHandler(search));

export default router;
