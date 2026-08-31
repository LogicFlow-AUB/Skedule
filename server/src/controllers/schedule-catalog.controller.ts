import type { RequestHandler } from 'express';

import {
  listOptimizerOptions,
  listTerms,
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
