import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as searchService from '../services/search.service.js';

type SearchQuery = { q: string; limit?: number };

export const search: RequestHandler = async (_req, res) => {
  const query = getValidated<SearchQuery>(res, 'query');
  const data = await searchService.search(query.q, query.limit);

  res.status(200).json({ data });
};
