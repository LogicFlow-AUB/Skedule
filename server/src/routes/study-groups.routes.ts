import { Router } from 'express';
import { z } from 'zod';

import {
  acceptJoinRequest,
  cancelJoinRequest,
  createStudyGroup,
  getStudyGroup,
  listJoinRequests,
  listMyStudyGroups,
  listStudyGroupMessages,
  listStudyGroups,
  rejectJoinRequest,
  removeStudyGroupMember,
  requestToJoinStudyGroup,
  sendStudyGroupMessage,
  updateStudyGroup,
} from '../controllers/study-groups.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const groupIdParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const groupAndUserParams = z
  .object({ id: z.coerce.number().int().positive(), userId: z.string().uuid() })
  .strict();
const listQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const createStudyGroupBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    courseId: z.number().int().positive(),
    bio: z.string().trim().max(2000).optional(),
    meetingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    // Times are optional individually, but when a time is being specified both
    // start and end must be provided (enforced by the client). A null value
    // explicitly clears a previously stored meeting time.
    startTime: z.union([z.string().trim().max(20), z.null()]).optional(),
    endTime: z.union([z.string().trim().max(20), z.null()]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const start = value.startTime ?? null;
    const end = value.endTime ?? null;
    if ((start != null || end != null) && (start == null || end == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Both start and end times must be provided together, or neither.',
      });
    }
  });

const messageBody = z
  .object({
    content: z.string().trim().min(1).max(2000),
  })
  .strict();

const messageListQuery = z
  .object({
    // Exclusive upper bound (ISO timestamp) for loading older chat history.
    before: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

const router = Router();

router.get('/', optionalAuth, validateQuery(listQuery), asyncHandler(listStudyGroups));
router.get('/mine', requireAuth, validateQuery(listQuery), asyncHandler(listMyStudyGroups));
router.get('/:id', optionalAuth, validateParams(groupIdParams), asyncHandler(getStudyGroup));
router.post('/', requireAuth, validateBody(createStudyGroupBody), asyncHandler(createStudyGroup));
router.patch(
  '/:id',
  requireAuth,
  validateParams(groupIdParams),
  validateBody(createStudyGroupBody),
  asyncHandler(updateStudyGroup),
);
router.get(
  '/:id/messages',
  requireAuth,
  validateParams(groupIdParams),
  validateQuery(messageListQuery),
  asyncHandler(listStudyGroupMessages),
);
router.post(
  '/:id/messages',
  requireAuth,
  validateParams(groupIdParams),
  validateBody(messageBody),
  asyncHandler(sendStudyGroupMessage),
);
router.delete(
  '/:id/members/:userId',
  requireAuth,
  validateParams(groupAndUserParams),
  asyncHandler(removeStudyGroupMember),
);
router.post(
  '/:id/requests',
  requireAuth,
  validateParams(groupIdParams),
  asyncHandler(requestToJoinStudyGroup),
);
router.delete(
  '/:id/requests',
  requireAuth,
  validateParams(groupIdParams),
  asyncHandler(cancelJoinRequest),
);
router.get(
  '/:id/requests',
  requireAuth,
  validateParams(groupIdParams),
  asyncHandler(listJoinRequests),
);
router.post(
  '/:id/requests/:userId/accept',
  requireAuth,
  validateParams(groupAndUserParams),
  asyncHandler(acceptJoinRequest),
);
router.post(
  '/:id/requests/:userId/reject',
  requireAuth,
  validateParams(groupAndUserParams),
  asyncHandler(rejectJoinRequest),
);

export default router;
