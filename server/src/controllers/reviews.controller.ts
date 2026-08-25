import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as reviewsService from '../services/reviews.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type CourseCodeParams = { code: string };
type ProfessorIdParams = { id: number };
type ProfessorReviewParams = { id: number; reviewId: number };
type ReviewsQuery = { page?: number; limit?: number };
type ReportInput = { reason: string };

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const createCourseReview: RequestHandler = async (req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  const data = await reviewsService.createCourseReview(
    getUserId(req),
    code,
    getValidated<reviewsService.CreateCourseReviewInput>(res, 'body'),
  );

  res.status(201).json({ data });
};

export const getCourseReviews: RequestHandler = async (_req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  const page = await reviewsService.getCourseReviews(
    code,
    parseOffsetPagination(getValidated<ReviewsQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const saveCourse: RequestHandler = async (req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  await reviewsService.saveCourse(getUserId(req), code);

  res.status(204).send();
};

export const unsaveCourse: RequestHandler = async (req, res) => {
  const { code } = getValidated<CourseCodeParams>(res, 'params');
  await reviewsService.unsaveCourse(getUserId(req), code);

  res.status(204).send();
};

export const listSavedCourses: RequestHandler = async (req, res) => {
  const page = await reviewsService.listSavedCourses(
    getUserId(req),
    parseOffsetPagination(getValidated<ReviewsQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const createProfessorReview: RequestHandler = async (req, res) => {
  const { id } = getValidated<ProfessorIdParams>(res, 'params');
  const data = await reviewsService.createProfessorReview(
    getUserId(req),
    id,
    getValidated<reviewsService.CreateProfessorReviewInput>(res, 'body'),
  );

  res.status(201).json({ data });
};

export const getProfessorReviews: RequestHandler = async (_req, res) => {
  const { id } = getValidated<ProfessorIdParams>(res, 'params');
  const page = await reviewsService.getProfessorReviews(
    id,
    parseOffsetPagination(getValidated<ReviewsQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const likeProfessorReview: RequestHandler = async (req, res) => {
  const { id, reviewId } = getValidated<ProfessorReviewParams>(res, 'params');
  await reviewsService.likeProfessorReview(getUserId(req), id, reviewId);

  res.status(204).send();
};

export const reportProfessorReview: RequestHandler = async (req, res) => {
  const { id, reviewId } = getValidated<ProfessorReviewParams>(res, 'params');
  const { reason } = getValidated<ReportInput>(res, 'body');
  await reviewsService.reportProfessorReview(getUserId(req), id, reviewId, reason);

  res.status(204).send();
};
