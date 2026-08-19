import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as trendingService from '../services/trending.service.js';

type TrendingQuery = { limit?: number };

export const getTrendingCourses: RequestHandler = async (_req, res) => {
  const { limit } = getValidated<TrendingQuery>(res, 'query');
  const data = await trendingService.getTrendingCourses(limit ?? 10);

  res.status(200).json({ data });
};

export const getTrendingProfessors: RequestHandler = async (_req, res) => {
  const { limit } = getValidated<TrendingQuery>(res, 'query');
  const data = await trendingService.getTrendingProfessors(limit ?? 10);

  res.status(200).json({ data });
};
