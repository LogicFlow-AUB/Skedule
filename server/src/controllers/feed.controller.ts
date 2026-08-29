import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as feedService from '../services/feed.service.js';
import { AppError } from '../utils/app-error.js';
import { parseOffsetPagination } from '../utils/pagination.js';

type PostIdParams = { id: number };
type CommentIdParams = { commentId: number };
type FeedQuery = { page?: number; limit?: number };

function getUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  }

  return req.userId;
}

export const listFeed: RequestHandler = async (req, res) => {
  const page = await feedService.listFeed(
    parseOffsetPagination(getValidated<FeedQuery>(res, 'query')),
    req.userId,
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const createPost: RequestHandler = async (req, res) => {
  const data = await feedService.createPost(
    getUserId(req),
    getValidated<feedService.CreatePostInput>(res, 'body'),
  );

  res.status(201).json({ data });
};

export const getPost: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  const data = await feedService.getPost(id, req.userId);

  res.status(200).json({ data });
};

export const deletePost: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  await feedService.deletePost(getUserId(req), id);

  res.status(204).send();
};

export const likePost: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  await feedService.likePost(getUserId(req), id);

  res.status(204).send();
};

export const unlikePost: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  await feedService.unlikePost(getUserId(req), id);

  res.status(204).send();
};

export const savePost: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  await feedService.savePost(getUserId(req), id);

  res.status(204).send();
};

export const unsavePost: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  await feedService.unsavePost(getUserId(req), id);

  res.status(204).send();
};

export const getComments: RequestHandler = async (_req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  const page = await feedService.getComments(
    id,
    parseOffsetPagination(getValidated<FeedQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const listMyComments: RequestHandler = async (req, res) => {
  const page = await feedService.listMyComments(
    getUserId(req),
    parseOffsetPagination(getValidated<FeedQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const listMyPosts: RequestHandler = async (req, res) => {
  const page = await feedService.listMyPosts(
    getUserId(req),
    parseOffsetPagination(getValidated<FeedQuery>(res, 'query')),
  );

  res.status(200).json({ data: page.data, pagination: page.pagination });
};

export const createComment: RequestHandler = async (req, res) => {
  const { id } = getValidated<PostIdParams>(res, 'params');
  const data = await feedService.createComment(
    getUserId(req),
    id,
    getValidated<feedService.CreateCommentInput>(res, 'body'),
  );

  res.status(201).json({ data });
};

export const deleteComment: RequestHandler = async (req, res) => {
  const { commentId } = getValidated<CommentIdParams>(res, 'params');
  await feedService.deleteComment(getUserId(req), commentId);

  res.status(204).send();
};
