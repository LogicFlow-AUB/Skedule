import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';

import api from './api.js';
import config from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.middleware.js';
import { startAubSyncJob } from './services/aub-sync.service.js';
import { logger } from './utils/logger.js';

const app = express();

app.disable('x-powered-by');
app.use(pinoHttp({ logger }));
app.use(
  cors({
    origin: config.clientOrigin,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Skedule API listening');
  startAubSyncJob();
});
