import { Router } from 'express';
import { z } from 'zod';

import { ingest, query } from '../controllers/rag.controller.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const queryBody = z
  .object({
    query: z.string().trim().min(1).max(1000),
    topK: z.number().int().positive().max(50).optional(),
  })
  .strict();

const ingestBody = z
  .object({
    documents: z.array(
      z
        .object({
          text: z.string().min(1),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })
        .strict(),
    ),
    chunkSize: z.number().int().positive().max(2000).optional(),
    chunkOverlap: z.number().int().min(0).max(500).optional(),
  })
  .strict();

const router = Router();

router.post('/query', validateBody(queryBody), asyncHandler(query));
router.post('/ingest', validateBody(ingestBody), asyncHandler(ingest));

export default router;
