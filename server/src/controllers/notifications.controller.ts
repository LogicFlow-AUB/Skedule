import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as notificationsService from '../services/notifications.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type NotificationIdParams = { id: number };
type NotificationsQuery = { page?: number; limit?: number };

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const listNotifications: RequestHandler = async (req, res) => {
  const page = await notificationsService.listNotifications(
    getUserId(req),
    parseOffsetPagination(getValidated<NotificationsQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const getUnreadCount: RequestHandler = async (req, res) => {
  const count = await notificationsService.getUnreadCount(getUserId(req));

  res.status(200).json({ data: { count } });
};

export const markAsRead: RequestHandler = async (req, res) => {
  const { id } = getValidated<NotificationIdParams>(res, 'params');
  await notificationsService.markAsRead(getUserId(req), id);

  res.status(204).send();
};

export const markAllAsRead: RequestHandler = async (req, res) => {
  await notificationsService.markAllAsRead(getUserId(req));

  res.status(204).send();
};
