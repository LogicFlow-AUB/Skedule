import { Router } from 'express';
import { z } from 'zod';

import { getProfessor, listProfessors } from '../controllers/professors.controller.js';
import { validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const professorIdParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const professorListQuery = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(['name', 'rating', 'difficulty', 'popularity']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

const router = Router();

router.get('/', validateQuery(professorListQuery), asyncHandler(listProfessors));
router.get('/:id', validateParams(professorIdParams), asyncHandler(getProfessor));

export default router;
