import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import { generateSchedulePdf } from '../services/schedule-export.service.js';
import * as schedulesService from '../services/schedules.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type ScheduleIdParams = { id: number };
type ScheduleCourseParams = { id: number; courseId: number };
type SchedulesQuery = { page?: number; limit?: number };
type SectionInput = { sectionId: number };
type CompareSchedulesInput = { scheduleIds: number[] };
type DraftQuery = { term_id?: number | null };

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const listSchedules: RequestHandler = async (req, res) => {
  const page = await schedulesService.listSchedules(
    getUserId(req),
    parseOffsetPagination(getValidated<SchedulesQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const createSchedule: RequestHandler = async (req, res) => {
  const data = await schedulesService.createSchedule(
    getUserId(req),
    getValidated<schedulesService.CreateScheduleInput>(res, 'body'),
  );

  res.status(201).json({ data });
};

export const getSchedule: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const data = await schedulesService.getSchedule(getUserId(req), id);

  res.status(200).json({ data });
};

export const updateSchedule: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const data = await schedulesService.updateSchedule(
    getUserId(req),
    id,
    getValidated<schedulesService.UpdateScheduleInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const deleteSchedule: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  await schedulesService.deleteSchedule(getUserId(req), id);

  res.status(204).send();
};

export const getDraft: RequestHandler = async (req, res) => {
  const query = getValidated<DraftQuery>(res, 'query');
  const data = await schedulesService.getDraft(getUserId(req), query.term_id ?? null);

  res.status(200).json({ data });
};

export const saveDraft: RequestHandler = async (req, res) => {
  const query = getValidated<DraftQuery>(res, 'query');
  const data = await schedulesService.saveDraft(
    getUserId(req),
    query.term_id ?? null,
    getValidated<schedulesService.SaveDraftInput>(res, 'body'),
  );

  res.status(200).json({ data });
};

export const saveSchedule: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const data = await schedulesService.saveSchedule(getUserId(req), id);

  res.status(200).json({ data });
};

export const setFavorite: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const data = await schedulesService.setFavorite(getUserId(req), id);

  res.status(200).json({ data });
};

export const loadScheduleAsDraft: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const data = await schedulesService.loadScheduleAsDraft(getUserId(req), id);

  res.status(200).json({ data });
};

export const addScheduleCourse: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const { sectionId } = getValidated<SectionInput>(res, 'body');
  const data = await schedulesService.addScheduleCourse(getUserId(req), id, sectionId);

  res.status(201).json({ data });
};

export const removeScheduleCourse: RequestHandler = async (req, res) => {
  const { id, courseId } = getValidated<ScheduleCourseParams>(res, 'params');
  await schedulesService.removeScheduleCourse(getUserId(req), id, courseId);

  res.status(204).send();
};

export const swapScheduleSection: RequestHandler = async (req, res) => {
  const { id, courseId } = getValidated<ScheduleCourseParams>(res, 'params');
  const { sectionId } = getValidated<SectionInput>(res, 'body');
  const data = await schedulesService.swapScheduleSection(getUserId(req), id, courseId, sectionId);

  res.status(200).json({ data });
};

export const compareSchedules: RequestHandler = async (req, res) => {
  const { scheduleIds } = getValidated<CompareSchedulesInput>(res, 'body');
  const data = await schedulesService.compareSchedules(getUserId(req), scheduleIds);

  res.status(200).json({ data });
};

export const getScheduleConflicts: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const data = await schedulesService.getScheduleConflicts(getUserId(req), id);

  res.status(200).json({ data });
};

export const exportSchedulePdf: RequestHandler = async (req, res) => {
  const { id } = getValidated<ScheduleIdParams>(res, 'params');
  const schedule = await schedulesService.getSchedule(getUserId(req), id);
  const pdf = await generateSchedulePdf(schedule);
  const fileName = (schedule.name ?? 'schedule').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'schedule';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
  res.status(200).send(pdf);
};
