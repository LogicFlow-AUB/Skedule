import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as authService from '../services/auth.service.js';
import type { LoginInput, RegisterInput } from '../services/auth.service.js';
import { AppError } from '../utils/app-error.js';

type RefreshInput = {
  refreshToken: string;
};

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  tokenHash: string;
  password: string;
  confirmPassword: string;
};

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const register: RequestHandler = async (_req, res) => {
  const result = await authService.register(getValidated<RegisterInput>(res, 'body'));

  res.status(201).json(result);
};

export const login: RequestHandler = async (_req, res) => {
  const result = await authService.login(getValidated<LoginInput>(res, 'body'));

  res.status(200).json(result);
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(getUserId(req));

  res.status(204).send();
};

export const refresh: RequestHandler = async (_req, res) => {
  const { refreshToken } = getValidated<RefreshInput>(res, 'body');
  const tokens = await authService.refresh(refreshToken);

  res.status(200).json({ tokens });
};

export const forgotPassword: RequestHandler = async (_req, res) => {
  const { email } = getValidated<ForgotPasswordInput>(res, 'body');
  await authService.requestPasswordReset(email);

  res.status(202).json({ message: 'If an account exists, reset instructions will be sent.' });
};

export const resetPassword: RequestHandler = async (_req, res) => {
  const input = getValidated<ResetPasswordInput>(res, 'body');
  await authService.resetPassword(input.tokenHash, input.password, input.confirmPassword);

  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  const user = await authService.getUser(getUserId(req));

  res.status(200).json({ user });
};
