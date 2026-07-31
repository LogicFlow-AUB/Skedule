import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../utils/app-error.js';

type RequestLocation = 'body' | 'params' | 'query';
type ValidatedRequestData = Partial<Record<RequestLocation, unknown>>;
type ValidatedResponse = Response & { locals: { validated?: ValidatedRequestData } };

function validate(schema: ZodType, location: RequestLocation): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[location]);

    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.'));
    }

    const validatedResponse = res as ValidatedResponse;
    validatedResponse.locals.validated = {
      ...validatedResponse.locals.validated,
      [location]: result.data,
    };
    next();
  };
}

export const validateBody = (schema: ZodType): RequestHandler => validate(schema, 'body');
export const validateParams = (schema: ZodType): RequestHandler => validate(schema, 'params');
export const validateQuery = (schema: ZodType): RequestHandler => validate(schema, 'query');

export function getValidated<T>(res: Parameters<RequestHandler>[1], location: RequestLocation): T {
  const value = (res as ValidatedResponse).locals.validated?.[location];

  if (value === undefined) {
    throw new AppError(500, 'VALIDATION_CONTEXT_MISSING', 'Validated request data is unavailable.');
  }

  return value as T;
}
