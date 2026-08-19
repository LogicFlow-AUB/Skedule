import { Router } from 'express';

import { checkSupabaseConnection } from './db/supabase.js';
import authRoutes from './routes/auth.routes.js';
import coursesRoutes from './routes/courses.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import feedRoutes from './routes/feed.routes.js';
import friendsRoutes from './routes/friends.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import professorsRoutes from './routes/professors.routes.js';
import schedulesRoutes from './routes/schedules.routes.js';
import searchRoutes from './routes/search.routes.js';
import trendingRoutes from './routes/trending.routes.js';
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
api.use('/courses', coursesRoutes);
api.use('/professors', professorsRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/schedules', schedulesRoutes);
api.use('/feed', feedRoutes);
api.use('/friends', friendsRoutes);
api.use('/notifications', notificationsRoutes);
api.use('/search', searchRoutes);
api.use('/trending', trendingRoutes);

export default api;
