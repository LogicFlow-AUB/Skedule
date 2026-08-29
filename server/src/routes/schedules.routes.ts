import { Router } from 'express';
import { z } from 'zod';

import {
  addScheduleCourse,
  compareSchedules,
  createSchedule,
  deleteSchedule,
  getDraft,
  getSchedule,
  getScheduleConflicts,
  listSchedules,
  loadScheduleAsDraft,
  removeScheduleCourse,
  saveDraft,
  saveSchedule,
  setFavorite,
  swapScheduleSection,
  unsetFavorite,
  updateSchedule,
} from '../controllers/schedules.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const identifier = z.coerce.number().int().positive();
const sectionId = z.number().int().positive();
const scheduleIdParams = z.object({ id: identifier }).strict();
const scheduleCourseParams = z.object({ id: identifier, courseId: identifier }).strict();
const schedulesQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const draftQuery = z
  .object({
    term_id: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict();
const createScheduleBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(1000).optional(),
    termId: z.number().int().positive().optional(),
    sectionIds: z.array(sectionId).max(20).optional(),
  })
  .strict();
const saveDraftBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    sectionIds: z.array(sectionId).max(20).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Request body must not be empty.');
const updateScheduleBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Request body must not be empty.');
const sectionBody = z.object({ sectionId }).strict();
const compareSchedulesBody = z
  .object({ scheduleIds: z.array(identifier).length(2) })
  .strict()
  .refine(
    (value) => value.scheduleIds[0] !== value.scheduleIds[1],
    'Choose two different schedules.',
  );

const router = Router();

router.get('/', requireAuth, validateQuery(schedulesQuery), asyncHandler(listSchedules));
router.post('/', requireAuth, validateBody(createScheduleBody), asyncHandler(createSchedule));
router.get('/draft', requireAuth, validateQuery(draftQuery), asyncHandler(getDraft));
router.put('/draft', requireAuth, validateQuery(draftQuery), validateBody(saveDraftBody), asyncHandler(saveDraft));
router.post(
  '/compare',
  requireAuth,
  validateBody(compareSchedulesBody),
  asyncHandler(compareSchedules),
);
router.post(
  '/:id/courses',
  requireAuth,
  validateParams(scheduleIdParams),
  validateBody(sectionBody),
  asyncHandler(addScheduleCourse),
);
router.put(
  '/:id/courses/:courseId/section',
  requireAuth,
  validateParams(scheduleCourseParams),
  validateBody(sectionBody),
  asyncHandler(swapScheduleSection),
);
router.delete(
  '/:id/courses/:courseId',
  requireAuth,
  validateParams(scheduleCourseParams),
  asyncHandler(removeScheduleCourse),
);
router.get(
  '/:id/conflicts',
  requireAuth,
  validateParams(scheduleIdParams),
  asyncHandler(getScheduleConflicts),
);
router.post('/:id/save', requireAuth, validateParams(scheduleIdParams), asyncHandler(saveSchedule));
router.post('/:id/favorite', requireAuth, validateParams(scheduleIdParams), asyncHandler(setFavorite));
router.delete('/:id/favorite', requireAuth, validateParams(scheduleIdParams), asyncHandler(unsetFavorite));
router.post('/:id/load', requireAuth, validateParams(scheduleIdParams), asyncHandler(loadScheduleAsDraft));
router.get('/:id', requireAuth, validateParams(scheduleIdParams), asyncHandler(getSchedule));
router.put(
  '/:id',
  requireAuth,
  validateParams(scheduleIdParams),
  validateBody(updateScheduleBody),
  asyncHandler(updateSchedule),
);
router.delete('/:id', requireAuth, validateParams(scheduleIdParams), asyncHandler(deleteSchedule));

export default router;
