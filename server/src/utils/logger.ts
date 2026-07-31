import pino from 'pino';

import config from '../config.js';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  base: null,
  redact: ['req.headers.authorization'],
});
