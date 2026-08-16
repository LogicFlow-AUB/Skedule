import { Router } from 'express';
import { z } from 'zod';

import {
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from '../controllers/notifications.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const notificationIdParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const notificationsQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

const router = Router();

router.get('/', requireAuth, validateQuery(notificationsQuery), asyncHandler(listNotifications));
router.get('/unread-count', requireAuth, asyncHandler(getUnreadCount));
router.put('/read-all', requireAuth, asyncHandler(markAllAsRead));
router.put(
  '/:id/read',
  requireAuth,
  validateParams(notificationIdParams),
  asyncHandler(markAsRead),
);

export default router;
