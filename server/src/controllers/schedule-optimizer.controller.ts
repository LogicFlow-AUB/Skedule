import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import { optimizeSchedule, type OptimizeRequestInput } from '../services/schedule-optimizer.service.js';
import { AppError } from '../utils/app-error.js';

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const optimize: RequestHandler = async (req, res) => {
  getUserId(req);
  const input = getValidated<OptimizeRequestInput>(res, 'body');
  const result = await optimizeSchedule(input);

  res.status(200).json({ data: result });
};
