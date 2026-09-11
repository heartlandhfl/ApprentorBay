import { Router } from 'express';
import type { HealthStatus } from '@apprentorbay/shared';
import { getAdminFirebase } from '../lib/firebase.js';
import { paymentsHealthSnapshot } from '../lib/payments/paymentConfig.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const firebase = getAdminFirebase();
  const payments = paymentsHealthSnapshot();

  const body: HealthStatus = {
    ok: true,
    service: 'apprentorbay-api',
    timestamp: new Date().toISOString(),
    firebase: {
      adminConfigured: firebase.configured,
      adminInitialized: firebase.initialized,
      emulator: firebase.emulator,
      error: firebase.error,
      keySource: firebase.keySource,
      keyBodyPrefix: firebase.keyBodyPrefix,
      keyBodyLength: firebase.keyBodyLength,
    },
    payments,
  };

  res.json(body);
});
