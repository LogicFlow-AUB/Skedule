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

export const listMyStudyGroups: RequestHandler = async (req, res) => {
  const pagination = parseOffsetPagination(
    getValidated<{ page?: number; limit?: number }>(res, 'query'),
  );
  const page = await studyGroupsService.listMyStudyGroups(getUserId(req), pagination);
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

export const requestToJoinStudyGroup: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  await studyGroupsService.requestToJoin(getUserId(req), id);
  res.status(201).json({ joined: false, requested: true });
};

export const cancelJoinRequest: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  await studyGroupsService.cancelJoinRequest(getUserId(req), id);
  res.status(204).send();
};

export const listJoinRequests: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  const requests = await studyGroupsService.listJoinRequests(getUserId(req), id);
  res.status(200).json({ data: requests });
};

export const acceptJoinRequest: RequestHandler = async (req, res) => {
  const { id, userId: requesterId } = getValidated<{ id: number; userId: string }>(res, 'params');
  await studyGroupsService.acceptJoinRequest(getUserId(req), id, requesterId);
  res.status(204).send();
};

export const rejectJoinRequest: RequestHandler = async (req, res) => {
  const { id, userId: requesterId } = getValidated<{ id: number; userId: string }>(res, 'params');
  await studyGroupsService.rejectJoinRequest(getUserId(req), id, requesterId);
  res.status(204).send();
};

export const listStudyGroupMessages: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  const query = getValidated<{ before?: string; limit?: number }>(res, 'query') ?? {};
  const history = await studyGroupsService.listStudyGroupMessages(getUserId(req), id, query);
  res.status(200).json(history);
};

export const sendStudyGroupMessage: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  const { content } = getValidated<{ content: string }>(res, 'body');
  const message = await studyGroupsService.sendStudyGroupMessage(getUserId(req), id, content);
  res.status(201).json({ data: message });
};

export const updateStudyGroup: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  const data = await studyGroupsService.updateStudyGroup(
    getUserId(req),
    id,
    getValidated<studyGroupsService.CreateStudyGroupInput>(res, 'body'),
  );
  res.status(200).json(data);
};

export const removeStudyGroupMember: RequestHandler = async (req, res) => {
  const { id, userId: memberId } = getValidated<{ id: number; userId: string }>(res, 'params');
  await studyGroupsService.removeStudyGroupMember(getUserId(req), id, memberId);
  res.status(204).send();
};
