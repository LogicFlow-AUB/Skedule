import { Router } from 'express';

import { checkSupabaseConnection } from './db/supabase.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import type { ApiHealthResponse } from './types.js';

const api = Router();

api.get('/health', async (_req, res) => {
  const supabaseStatus = await checkSupabaseConnection();
  const isHealthy = supabaseStatus === 'connected';
  const response: ApiHealthResponse = {
    status: isHealthy ? 'ok' : 'degraded',
    supabase: { status: supabaseStatus },
  };

  res.status(isHealthy ? 200 : 503).json(response);
});

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);

export default api;
