import { Router } from 'express';
import { paymentService } from '../lib/payments/paymentService.js';
import { getPaymentProvider } from '../lib/payments/registry.js';

export const paymentWebhooksRouter = Router();

paymentWebhooksRouter.post('/', async (req, res, next) => {
  try {
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      res.status(400).json({ error: { code: 'invalid', message: 'Webhook body required' } });
      return;
    }

    const provider = getPaymentProvider();
    const events = await provider.verifyAndParseWebhook(req.headers, rawBody);
    await paymentService.handleWebhookEvents(events);
    res.json({ received: true, processed: events.length });
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const message =
      error instanceof Error ? error.message : 'Webhook processing failed';
    if (status >= 500) {
      next(error);
      return;
    }
    res.status(status).json({ error: { code: 'invalid', message } });
  }
});
