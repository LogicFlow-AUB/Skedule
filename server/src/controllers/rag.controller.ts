import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import * as ragService from '../services/rag.service.js';

type QueryBody = { query: string; topK?: number };
type IngestBody = {
  documents: { text: string; metadata?: Record<string, unknown> }[];
  chunkSize?: number;
  chunkOverlap?: number;
};

export const query: RequestHandler = async (_req, res) => {
  const { query, topK } = getValidated<QueryBody>(res, 'body');
  const results = await ragService.retrieveChunks(query, topK);

  res.status(200).json({ data: results });
};

export const ingest: RequestHandler = async (_req, res) => {
  const input = getValidated<IngestBody>(res, 'body');
  const result = await ragService.ingestDocuments(input);

  res.status(201).json({ data: result });
};
