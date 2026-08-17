import { Router } from 'express';
import { z } from 'zod';

import {
  cancelRsvp,
  createEvent,
  getEvent,
  listEvents,
  rsvpEvent,
} from '../controllers/events.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const eventIdParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const eventsQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();
const createEventBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(['registration', 'deadline', 'class', 'exam', 'study', 'academic', 'social']),
    startsAt: z.string(),
    endsAt: z.string().optional(),
    description: z.string().trim().max(5000).optional(),
    location: z.string().trim().max(200).optional(),
    termId: z.number().int().positive().optional(),
  })
  .strict();

const router = Router();

router.get('/', validateQuery(eventsQuery), asyncHandler(listEvents));
router.get('/:id', validateParams(eventIdParams), asyncHandler(getEvent));
router.post('/', requireAuth, validateBody(createEventBody), asyncHandler(createEvent));
router.post('/:id/rsvp', requireAuth, validateParams(eventIdParams), asyncHandler(rsvpEvent));
router.delete('/:id/rsvp', requireAuth, validateParams(eventIdParams), asyncHandler(cancelRsvp));

export default router;
