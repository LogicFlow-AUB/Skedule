import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as dashboardService from '../services/dashboard.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type ActivityQuery = { page?: number; limit?: number };

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const getStats: RequestHandler = async (req, res) => {
  const data = await dashboardService.getDashboardStats(getUserId(req));
  res.status(200).json({ data });
};

export const getUpcoming: RequestHandler = async (_req, res) => {
  const data = await dashboardService.getUpcomingEvents();
  res.status(200).json({ data });
};

export const getActivity: RequestHandler = async (req, res) => {
  const page = await dashboardService.getActivity(
    getUserId(req),
    parseOffsetPagination(getValidated<ActivityQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};
