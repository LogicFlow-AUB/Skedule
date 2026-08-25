import { Router } from 'express';
import { z } from 'zod';

import {
  acceptFriendRequest,
  getCommonFreeTime,
  getFriendRequests,
  getSuggestedFriends,
  listFriends,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
  searchStudents,
} from '../controllers/friends.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const userIdParams = z.object({ userId: z.string().uuid() }).strict();
const suggestedQuery = z
  .object({ limit: z.coerce.number().int().positive().max(50).optional() })
  .strict();
const studentSearchQuery = z
  .object({
    query: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict();

const router = Router();

router.get('/', requireAuth, asyncHandler(listFriends));
router.get(
  '/suggested',
  requireAuth,
  validateQuery(suggestedQuery),
  asyncHandler(getSuggestedFriends),
);
router.get('/search', requireAuth, validateQuery(studentSearchQuery), asyncHandler(searchStudents));
router.get('/requests', requireAuth, asyncHandler(getFriendRequests));
router.get('/common-free-time', requireAuth, asyncHandler(getCommonFreeTime));
router.post(
  '/requests/:userId',
  requireAuth,
  validateParams(userIdParams),
  asyncHandler(sendFriendRequest),
);
router.post(
  '/requests/:userId/accept',
  requireAuth,
  validateParams(userIdParams),
  asyncHandler(acceptFriendRequest),
);
router.post(
  '/requests/:userId/reject',
  requireAuth,
  validateParams(userIdParams),
  asyncHandler(rejectFriendRequest),
);
router.delete('/:userId', requireAuth, validateParams(userIdParams), asyncHandler(removeFriend));

export default router;
