import { Router } from 'express';
import { z } from 'zod';

import {
  createComment,
  createPost,
  deletePost,
  getComments,
  getPost,
  likePost,
  listFeed,
  savePost,
  unlikePost,
  unsavePost,
} from '../controllers/feed.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const postIdParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const feedQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const createPostBody = z
  .object({
    type: z.enum(['schedule', 'review', 'question', 'tip']),
    content: z.string().trim().min(1).max(5000),
    tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    scheduleId: z.number().int().positive().optional(),
  })
  .strict();
const commentBody = z.object({ content: z.string().trim().min(1).max(2000) }).strict();

const router = Router();

router.get('/', optionalAuth, validateQuery(feedQuery), asyncHandler(listFeed));
router.post('/', requireAuth, validateBody(createPostBody), asyncHandler(createPost));
router.post('/:id/like', requireAuth, validateParams(postIdParams), asyncHandler(likePost));
router.delete('/:id/like', requireAuth, validateParams(postIdParams), asyncHandler(unlikePost));
router.post('/:id/save', requireAuth, validateParams(postIdParams), asyncHandler(savePost));
router.delete('/:id/save', requireAuth, validateParams(postIdParams), asyncHandler(unsavePost));
router.get(
  '/:id/comments',
  optionalAuth,
  validateParams(postIdParams),
  validateQuery(feedQuery),
  asyncHandler(getComments),
);
router.post(
  '/:id/comments',
  requireAuth,
  validateParams(postIdParams),
  validateBody(commentBody),
  asyncHandler(createComment),
);
router.get('/:id', optionalAuth, validateParams(postIdParams), asyncHandler(getPost));
router.delete('/:id', requireAuth, validateParams(postIdParams), asyncHandler(deletePost));

export default router;
