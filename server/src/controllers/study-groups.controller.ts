import type { RequestHandler } from 'express';

import { parseOffsetPagination } from '../utils/pagination.js';
import { getValidated } from '../middleware/validation.middleware.js';
import { AppError } from '../utils/app-error.js';
import * as studyGroupsService from '../services/study-groups.service.js';

function getUserId(req: { userId?: string }): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  return req.userId;
}

export const listStudyGroups: RequestHandler = async (req, res) => {
  const pagination = parseOffsetPagination(
    getValidated<{ page?: number; limit?: number }>(res, 'query'),
  );
  const page = await studyGroupsService.listStudyGroups(pagination, req.userId);
  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const getStudyGroup: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  const group = await studyGroupsService.getStudyGroup(id, req.userId);
  res.status(200).json(group);
};

export const createStudyGroup: RequestHandler = async (req, res) => {
  const data = await studyGroupsService.createStudyGroup(
    getUserId(req),
    getValidated<studyGroupsService.CreateStudyGroupInput>(res, 'body'),
  );
  res.status(201).json(data);
};

export const joinStudyGroup: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  await studyGroupsService.joinStudyGroup(getUserId(req), id);
  res.status(204).send();
};

export const leaveStudyGroup: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  await studyGroupsService.leaveStudyGroup(getUserId(req), id);
  res.status(204).send();
};
