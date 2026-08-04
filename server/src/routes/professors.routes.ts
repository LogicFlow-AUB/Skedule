import { Router } from 'express';
import { z } from 'zod';

import { getProfessor, listProfessors } from '../controllers/professors.controller.js';
import {
  createProfessorReview,
  getProfessorReviews,
  likeProfessorReview,
  reportProfessorReview,
} from '../controllers/reviews.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
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
const professorReviewParams = z
  .object({
    id: z.coerce.number().int().positive(),
    reviewId: z.coerce.number().int().positive(),
  })
  .strict();
const reviewsQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const professorReviewBody = z
  .object({
    rating: z.number().int().min(1).max(5),
    difficulty: z.number().int().min(1).max(5).optional(),
    wouldRetake: z.boolean().optional(),
    comment: z.string().trim().min(1).max(5000).optional(),
  })
  .strict();
const reportBody = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();

const router = Router();

router.get('/', validateQuery(professorListQuery), asyncHandler(listProfessors));
router.post(
  '/:id/reviews',
  requireAuth,
  validateParams(professorIdParams),
  validateBody(professorReviewBody),
  asyncHandler(createProfessorReview),
);
router.get(
  '/:id/reviews',
  validateParams(professorIdParams),
  validateQuery(reviewsQuery),
  asyncHandler(getProfessorReviews),
);
router.post(
  '/:id/reviews/:reviewId/like',
  requireAuth,
  validateParams(professorReviewParams),
  asyncHandler(likeProfessorReview),
);
router.post(
  '/:id/reviews/:reviewId/report',
  requireAuth,
  validateParams(professorReviewParams),
  validateBody(reportBody),
  asyncHandler(reportProfessorReview),
);
router.get('/:id', validateParams(professorIdParams), asyncHandler(getProfessor));

export default router;
