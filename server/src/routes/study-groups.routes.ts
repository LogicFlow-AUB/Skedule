import { Router } from 'express';
import { z } from 'zod';

import {
  createStudyGroup,
  getStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  listStudyGroups,
} from '../controllers/study-groups.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const groupIdParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const studyGroupsQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const createStudyGroupBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    courseCode: z.string().trim().max(20).optional(),
    description: z.string().trim().max(2000).optional(),
    meetingTime: z.string().trim().max(100).optional(),
    location: z.string().trim().max(200).optional(),
    maxMembers: z.number().int().min(2).max(100).optional(),
  })
  .strict();

const router = Router();

router.get('/', validateQuery(studyGroupsQuery), asyncHandler(listStudyGroups));
router.get('/:id', validateParams(groupIdParams), asyncHandler(getStudyGroup));
router.post('/', requireAuth, validateBody(createStudyGroupBody), asyncHandler(createStudyGroup));
router.post('/:id/join', requireAuth, validateParams(groupIdParams), asyncHandler(joinStudyGroup));
router.delete(
  '/:id/join',
  requireAuth,
  validateParams(groupIdParams),
  asyncHandler(leaveStudyGroup),
);

export default router;
