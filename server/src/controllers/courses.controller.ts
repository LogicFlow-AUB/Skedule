import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as coursesService from '../services/courses.service.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type CourseCodeParams = { code: string };
type CourseListQuery = {
  search?: string;
  attribute?: string;
  sort: coursesService.CourseListInput['sort'];
  order: coursesService.CourseListInput['order'];
  page?: number;
  limit?: number;
};
type CompareCoursesInput = { codes: string[] };

export const listCourses: RequestHandler = async (_req, res) => {
  const query = getValidated<CourseListQuery>(res, 'query');
  const page = await coursesService.listCourses({
    ...(query.search ? { search: query.search } : {}),
    ...(query.attribute ? { attribute: query.attribute } : {}),
    sort: query.sort,
    order: query.order,
    pagination: parseOffsetPagination(query),
  });

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const getCourse: RequestHandler = async (_req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  const data = await coursesService.getCourse(code);

  res.status(200).json({ data });
};

export const getSections: RequestHandler = async (_req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  const data = await coursesService.getSections(code);

  res.status(200).json({ data });
};

export const getGradeDistribution: RequestHandler = async (_req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  const data = await coursesService.getGradeDistribution(code);

  res.status(200).json({ data });
};

export const compareCourses: RequestHandler = async (_req, res) => {
  const { codes } = getValidated<CompareCoursesInput>(res, 'body');
  const data = await coursesService.compareCourses(codes);

  res.status(200).json({ data });
};
