import { Router } from 'express';
import { z } from 'zod';

import {
  changePassword,
  deleteAccount,
  getAchievements,
  getCompletedCourses,
  getFavoriteProfessors,
  getProfile,
  getReviews,
  getStats,
  getWishlist,
  updateAvatar,
  updateNotificationSettings,
  updatePrivacySettings,
  updateProfile,
  updateTheme,
} from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const userIdParams = z.object({ id: z.string().trim().min(1).max(255) }).strict();

const nonEmptyBody = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) =>
  schema.refine((value) => Object.keys(value).length > 0, 'Request body must not be empty.');

const profileUpdateBody = nonEmptyBody(
  z
    .object({
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      major: z.string().trim().min(1).max(100).optional(),
      level: z.string().trim().min(1).max(50).optional(),
    })
    .strict(),
);

const notificationSettingsBody = nonEmptyBody(
  z
    .object({
      friendRequests: z.boolean().optional(),
      friendAcceptances: z.boolean().optional(),
      postLikes: z.boolean().optional(),
      postComments: z.boolean().optional(),
      reviewLikes: z.boolean().optional(),
      scheduleShares: z.boolean().optional(),
      registrationReminders: z.boolean().optional(),
    })
    .strict(),
);

const privacySettingsBody = nonEmptyBody(
  z
    .object({
      profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
      showCompletedCourses: z.boolean().optional(),
      showSchedule: z.boolean().optional(),
      showOnlineStatus: z.boolean().optional(),
    })
    .strict(),
);

const password = z.string().min(8).max(128);
const passwordChangeBody = z
  .object({
    currentPassword: password,
    password,
    confirmPassword: password,
  })
  .strict();

const themeBody = z.object({ theme: z.enum(['light', 'dark', 'system']) }).strict();

const avatarBody = z
  .object({
    avatarUrl: z.string().trim().url().max(2048),
  })
  .strict();

const reviewsQuery = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

const router = Router();

router.put(
  '/me/profile',
  requireAuth,
  validateBody(profileUpdateBody),
  asyncHandler(updateProfile),
);
router.put(
  '/me/notifications',
  requireAuth,
  validateBody(notificationSettingsBody),
  asyncHandler(updateNotificationSettings),
);
router.put(
  '/me/privacy',
  requireAuth,
  validateBody(privacySettingsBody),
  asyncHandler(updatePrivacySettings),
);
router.put(
  '/me/password',
  requireAuth,
  validateBody(passwordChangeBody),
  asyncHandler(changePassword),
);
router.put('/me/theme', requireAuth, validateBody(themeBody), asyncHandler(updateTheme));
router.post('/me/avatar', requireAuth, validateBody(avatarBody), asyncHandler(updateAvatar));
router.delete('/me/account', requireAuth, asyncHandler(deleteAccount));

router.get('/:id/profile', validateParams(userIdParams), asyncHandler(getProfile));
router.get('/:id/achievements', validateParams(userIdParams), asyncHandler(getAchievements));
router.get(
  '/:id/favorite-professors',
  validateParams(userIdParams),
  asyncHandler(getFavoriteProfessors),
);
router.get('/:id/wishlist', validateParams(userIdParams), asyncHandler(getWishlist));
router.get('/:id/stats', validateParams(userIdParams), asyncHandler(getStats));
router.get(
  '/:id/completed-courses',
  validateParams(userIdParams),
  asyncHandler(getCompletedCourses),
);
router.get(
  '/:id/reviews',
  validateParams(userIdParams),
  validateQuery(reviewsQuery),
  asyncHandler(getReviews),
);

export default router;
