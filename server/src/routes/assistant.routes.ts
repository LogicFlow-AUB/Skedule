import { Router } from 'express';
import { z } from 'zod';

import { chat } from '../controllers/assistant.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const chatBody = z
  .object({
    message: z.string().trim().min(1).max(2000),
    sessionId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const router = Router();

router.post('/chat', requireAuth, validateBody(chatBody), asyncHandler(chat));

export default router;
