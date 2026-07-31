import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as usersService from '../services/users.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type UserIdParams = { id: string };

type ReviewsQuery = {
  page?: number;
  limit?: number;
};

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

function respondWithUserResource(handler: (userId: string) => Promise<unknown>): RequestHandler {
  return async (_req, res) => {
    const data = await handler(getValidated<UserIdParams>(res, 'params').id);
    res.status(200).json({ data });
  };
}

export const getProfile = respondWithUserResource(usersService.getProfile);
export const getAchievements = respondWithUserResource(usersService.getAchievements);
export const getFavoriteProfessors = respondWithUserResource(usersService.getFavoriteProfessors);
export const getWishlist = respondWithUserResource(usersService.getWishlist);
export const getStats = respondWithUserResource(usersService.getStats);
export const getCompletedCourses = respondWithUserResource(usersService.getCompletedCourses);

export const getReviews: RequestHandler = async (_req, res) => {
  const userId = getValidated<UserIdParams>(res, 'params').id;
  const query = getValidated<ReviewsQuery>(res, 'query');
  const page = await usersService.getReviews(userId, parseOffsetPagination(query));

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const updateProfile: RequestHandler = async (req, res) => {
  const data = await usersService.updateProfile(
    getUserId(req),
    getValidated<usersService.ProfileUpdateInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const updateNotificationSettings: RequestHandler = async (req, res) => {
  const data = await usersService.updateNotificationSettings(
    getUserId(req),
    getValidated<usersService.NotificationSettingsInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const updatePrivacySettings: RequestHandler = async (req, res) => {
  const data = await usersService.updatePrivacySettings(
    getUserId(req),
    getValidated<usersService.PrivacySettingsInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const changePassword: RequestHandler = async (req, res) => {
  await usersService.changePassword(
    getUserId(req),
    getValidated<usersService.PasswordChangeInput>(res, 'body'),
  );

  res.status(204).send();
};

export const updateTheme: RequestHandler = async (req, res) => {
  const data = await usersService.updateTheme(
    getUserId(req),
    getValidated<usersService.ThemeInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const updateAvatar: RequestHandler = async (req, res) => {
  const data = await usersService.updateAvatar(
    getUserId(req),
    getValidated<usersService.AvatarInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const deleteAccount: RequestHandler = async (req, res) => {
  await usersService.deleteAccount(getUserId(req));

  res.status(204).send();
};
