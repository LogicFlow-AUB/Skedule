import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { ApiErrorBody } from '../types.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

export { AppError } from '../utils/app-error.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found.`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next;
  const appError = error instanceof AppError ? error : undefined;
  const statusCode = appError?.statusCode ?? 500;
  const response: ApiErrorBody = {
    error: {
      code: appError?.code ?? 'INTERNAL_SERVER_ERROR',
      message: appError?.message ?? 'An unexpected error occurred.',
    },
  };

  if (statusCode >= 500) {
    logger.error(
      { err: error, method: req.method, path: req.originalUrl },
      'Unhandled request error',
    );
  }

  res.status(statusCode).json(response);
};
