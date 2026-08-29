import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import {
  listOptimizerOptions,
  listTerms,
  searchOfferedCourses,
} from '../services/schedule-catalog.service.js';
import { AppError } from '../utils/app-error.js';

function ensureUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  return req.userId;
}

export const listOptions: RequestHandler = async (req, res) => {
  ensureUserId(req);
  const options = await listOptimizerOptions();
  res.status(200).json(options);
};

export const listScheduleTerms: RequestHandler = async (req, res) => {
  ensureUserId(req);
  const terms = await listTerms();
  res.status(200).json({ data: terms });
};

export const searchCourses: RequestHandler = async (req, res) => {
  ensureUserId(req);
  const query = getValidated<{ term_id?: number; search?: string }>(res, 'query');
  const courses = await searchOfferedCourses(query.term_id ?? null, query.search);
  res.status(200).json({ data: courses });
};
