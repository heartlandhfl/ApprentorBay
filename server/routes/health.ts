import { Router } from 'express';
import type { HealthStatus } from '@apprentorbay/shared';
import { getAdminFirebase } from '../lib/firebase.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const firebase = getAdminFirebase();

  const body: HealthStatus = {
    ok: true,
    service: 'apprentorbay-api',
    timestamp: new Date().toISOString(),
    firebase: {
      adminConfigured: firebase.configured,
      adminInitialized: firebase.initialized,
    },
  };

  res.json(body);
});
