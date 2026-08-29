import { Router } from 'express';
import { z } from 'zod';

import { optimize } from '../controllers/schedule-optimizer.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const positiveInt = z.number().int().positive();
const nonNegativeNumber = z.number().nonnegative();

const weightsSchema = z
  .object({
    days: nonNegativeNumber,
    gaps: nonNegativeNumber,
    professor: nonNegativeNumber,
  })
  .strict()
  .refine((value) => Math.abs(value.days + value.gaps + value.professor - 100) < 1e-6, {
    message: 'The days, gaps, and professor weights must total 100.',
  });

const optimizeBody = z
  .object({
    request_id: z.string().trim().max(128).optional(),
    term_id: positiveInt,
    required_course_ids: z.array(positiveInt).min(1),
    acceptable_elective_course_ids: z.array(positiveInt).default([]),
    attribute_ids: z.array(positiveInt).optional(),
    min_credits: nonNegativeNumber,
    max_credits: nonNegativeNumber,
    weights: weightsSchema,
    professor_preferences: z
      .record(z.string(), z.number().nonnegative())
      .refine(
        (value) => Object.keys(value).every((key) => /^\d+$/.test(key)),
        'Professor preference keys must be professor IDs.',
      )
      .optional(),
    excluded_section_ids: z.array(positiveInt).optional(),
    max_occurrences_per_day: positiveInt.optional(),
  })
  .strict()
  .refine((value) => value.min_credits <= value.max_credits, {
    message: 'min_credits cannot exceed max_credits.',
  })
  .refine(
    (value) =>
      value.required_course_ids.filter((id) => value.acceptable_elective_course_ids.includes(id))
        .length === 0,
    {
      message: 'A course cannot be both required and elective.',
    },
  );

const router = Router();

router.post('/optimize', requireAuth, validateBody(optimizeBody), asyncHandler(optimize));

export default router;
