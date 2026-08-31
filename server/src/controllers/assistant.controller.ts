import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import { handleMessage } from '../services/assistant.service.js';

type ChatBody = {
  message: string;
  sessionId?: string;
  termId?: number | null;
};

export const chat: RequestHandler = async (req, res) => {
  const { message, sessionId, termId } = getValidated<ChatBody>(res, 'body');
  const userId = req.userId!;
  const resolvedSessionId = sessionId || userId;

  const result = await handleMessage(message, userId, resolvedSessionId, termId ?? null);

  res.status(200).json({ data: result });
};
