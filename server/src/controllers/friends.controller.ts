import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as friendsService from '../services/friends.service.js';
import { AppError } from '../utils/app-error.js';

type UserIdParams = { userId: string };
type SuggestedQuery = { limit?: number };
type StudentSearchQuery = { query: string; limit?: number };

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const listFriends: RequestHandler = async (req, res) => {
  const data = await friendsService.listFriends(getUserId(req));

  res.status(200).json({ data });
};

export const getSuggestedFriends: RequestHandler = async (req, res) => {
  const { limit } = getValidated<SuggestedQuery>(res, 'query');
  const data = await friendsService.getSuggestedFriends(getUserId(req), limit ?? 10);

  res.status(200).json({ data });
};

export const searchStudents: RequestHandler = async (req, res) => {
  const { query, limit } = getValidated<StudentSearchQuery>(res, 'query');
  const data = await friendsService.searchStudents(getUserId(req), query, limit ?? 10);

  res.status(200).json({ data });
};

export const getFriendRequests: RequestHandler = async (req, res) => {
  const data = await friendsService.getFriendRequests(getUserId(req));

  res.status(200).json({ data });
};

export const sendFriendRequest: RequestHandler = async (req, res) => {
  const { userId } = getValidated<UserIdParams>(res, 'params');
  const data = await friendsService.sendFriendRequest(getUserId(req), userId);

  res.status(201).json({ data });
};

export const acceptFriendRequest: RequestHandler = async (req, res) => {
  const { userId } = getValidated<UserIdParams>(res, 'params');
  const data = await friendsService.acceptFriendRequest(getUserId(req), userId);

  res.status(200).json({ data });
};

export const rejectFriendRequest: RequestHandler = async (req, res) => {
  const { userId } = getValidated<UserIdParams>(res, 'params');
  await friendsService.rejectFriendRequest(getUserId(req), userId);

  res.status(204).send();
};

export const removeFriend: RequestHandler = async (req, res) => {
  const { userId } = getValidated<UserIdParams>(res, 'params');
  await friendsService.removeFriend(getUserId(req), userId);

  res.status(204).send();
};

export const getCommonFreeTime: RequestHandler = async (req, res) => {
  const data = await friendsService.getCommonFreeTime(getUserId(req));

  res.status(200).json({ data });
};
