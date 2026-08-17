import type { RequestHandler } from 'express';

import { parseOffsetPagination } from '../utils/pagination.js';
import { getValidated } from '../middleware/validation.middleware.js';
import { AppError } from '../utils/app-error.js';
import * as eventsService from '../services/events.service.js';

function getUserId(req: { userId?: string }): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }
  return req.userId;
}

export const listEvents: RequestHandler = async (req, res) => {
  const pagination = parseOffsetPagination(
    getValidated<{ page?: number; limit?: number }>(res, 'query'),
  );
  const page = await eventsService.listEvents(pagination, req.userId);
  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const getEvent: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  const event = await eventsService.getEvent(id, req.userId);
  res.status(200).json(event);
};

export const createEvent: RequestHandler = async (req, res) => {
  const data = await eventsService.createEvent(
    getUserId(req),
    getValidated<eventsService.CreateEventInput>(res, 'body'),
  );
  res.status(201).json(data);
};

export const rsvpEvent: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  await eventsService.rsvpEvent(getUserId(req), id);
  res.status(204).send();
};

export const cancelRsvp: RequestHandler = async (req, res) => {
  const { id } = getValidated<{ id: number }>(res, 'params');
  await eventsService.cancelRsvp(getUserId(req), id);
  res.status(204).send();
};
