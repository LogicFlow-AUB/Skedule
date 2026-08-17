import type { RequestHandler } from 'express';

import { requireAuthClient } from '../db/supabase.js';
import { AppError } from '../utils/app-error.js';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('authorization');

  if (!authorization) {
    return next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.'));
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(
      new AppError(401, 'INVALID_AUTHORIZATION_HEADER', 'Use a Bearer authentication token.'),
    );
  }

  try {
    const authDb = requireAuthClient();
    const { data, error } = await authDb.auth.getUser(token);

    if (error || !data.user) {
      return next(
        new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid or expired.'),
      );
    }

    req.userId = data.user.id;
    next();
  } catch (error) {
    next(error);
  }
};
