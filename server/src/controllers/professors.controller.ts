import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as professorsService from '../services/professors.service.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type ProfessorIdParams = { id: number };
type ProfessorListQuery = {
  search?: string;
  sort: professorsService.ProfessorListInput['sort'];
  order: professorsService.ProfessorListInput['order'];
  page?: number;
  limit?: number;
};

export const listProfessors: RequestHandler = async (_req, res) => {
  const query = getValidated<ProfessorListQuery>(res, 'query');
  const page = await professorsService.listProfessors({
    ...(query.search ? { search: query.search } : {}),
    sort: query.sort,
    order: query.order,
    pagination: parseOffsetPagination(query),
  });

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const getProfessor: RequestHandler = async (_req, res) => {
  const { id } = getValidated<ProfessorIdParams>(res, 'params');
  const data = await professorsService.getProfessor(id);

  res.status(200).json({ data });
};
