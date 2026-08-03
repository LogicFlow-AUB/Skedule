import { Router } from 'express';
import { z } from 'zod';

import {
  compareCourses,
  getCourse,
  getGradeDistribution,
  getSections,
  listCourses,
} from '../controllers/courses.controller.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const courseCode = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => value.toUpperCase());
const courseCodeParams = z.object({ code: courseCode }).strict();
const courseListQuery = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    attribute: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(['name', 'rating', 'difficulty', 'workload', 'popularity']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const compareCoursesBody = z
  .object({ codes: z.array(courseCode).length(2) })
  .strict()
  .refine((value) => value.codes[0] !== value.codes[1], 'Choose two different courses.');

const router = Router();

router.get('/', validateQuery(courseListQuery), asyncHandler(listCourses));
router.post('/compare', validateBody(compareCoursesBody), asyncHandler(compareCourses));
router.get('/:code/sections', validateParams(courseCodeParams), asyncHandler(getSections));
router.get(
  '/:code/grade-distribution',
  validateParams(courseCodeParams),
  asyncHandler(getGradeDistribution),
);
router.get('/:code', validateParams(courseCodeParams), asyncHandler(getCourse));

export default router;
