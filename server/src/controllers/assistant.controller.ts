import type { RequestHandler } from 'express';

import { getValidated } from '../middleware/validation.middleware.js';
import { handleMessage } from '../services/assistant.service.js';

type ChatBody = {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
};

export const chat: RequestHandler = async (req, res) => {
  const { message } = getValidated<ChatBody>(res, 'body');
  const userId = req.userId!;

  const result = await handleMessage(message, userId);

  res.status(200).json({ data: result });
};
