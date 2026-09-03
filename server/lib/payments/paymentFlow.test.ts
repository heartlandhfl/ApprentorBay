import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  MOCK_WEBHOOK_SIGNATURE_HEADER,
  MOCK_WEBHOOK_SIGNATURE_VALUE,
  MockPaymentProvider,
} from './providers/mockProvider.js';

describe('mock payment provider webhooks', () => {
  const provider = new MockPaymentProvider();

  beforeEach(() => {
    provider.reset();
  });

  it('accepts a valid webhook signature', async () => {
    const events = await provider.verifyAndParseWebhook(
      { [MOCK_WEBHOOK_SIGNATURE_HEADER]: MOCK_WEBHOOK_SIGNATURE_VALUE },
      Buffer.from(
        JSON.stringify({
          events: [
            {
              type: 'payment_succeeded',
              providerPaymentIntentId: 'pi_mock_1',
              paidAt: '2026-09-03T18:00:00.000Z',
              providerEventId: 'evt_1',
            },
          ],
        }),
      ),
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, 'payment_succeeded');
  });

  it('rejects an invalid webhook signature', async () => {
    await assert.rejects(
      () =>
        provider.verifyAndParseWebhook(
          { [MOCK_WEBHOOK_SIGNATURE_HEADER]: 'invalid' },
          Buffer.from(JSON.stringify({ events: [] })),
        ),
      /Invalid mock webhook signature/,
    );
  });

  it('treats duplicate provider event ids as separate parse results for idempotent handling upstream', async () => {
    const body = Buffer.from(
      JSON.stringify({
        events: [
          {
            type: 'payment_succeeded',
            providerPaymentIntentId: 'pi_mock_dup',
            paidAt: '2026-09-03T18:00:00.000Z',
            providerEventId: 'evt_dup',
          },
        ],
      }),
    );
    const headers = { [MOCK_WEBHOOK_SIGNATURE_HEADER]: MOCK_WEBHOOK_SIGNATURE_VALUE };
    const first = await provider.verifyAndParseWebhook(headers, body);
    const second = await provider.verifyAndParseWebhook(headers, body);
    assert.deepEqual(first, second);
  });
});

describe('mock payment provider checkout lifecycle', () => {
  const provider = new MockPaymentProvider();

  beforeEach(() => {
    provider.reset();
  });

  it('creates provider checkout sessions without client-supplied amounts', async () => {
    const result = await provider.createCheckoutSession({
      paymentIntentId: 'pi_local_1',
      bookingId: 'booking-1',
      amountCents: 7500,
      currency: 'USD',
      title: 'Mentorship session',
      learnerId: 'learner-1',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      idempotencyKey: 'checkout-1',
      metadata: { apprentorbay_booking_id: 'booking-1' },
    });
    assert.match(result.checkoutUrl, /^https:\/\/mock-payments\.test\/checkout\//);
    assert.match(result.providerPaymentIntentId, /^pi_mock_/);
  });

  it('reports cancelled checkout as non-paid provider status until reconciled', async () => {
    const result = await provider.createCheckoutSession({
      paymentIntentId: 'pi_local_2',
      bookingId: 'booking-2',
      amountCents: 7500,
      currency: 'USD',
      title: 'Mentorship session',
      learnerId: 'learner-1',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      idempotencyKey: 'checkout-2',
      metadata: {},
    });
    provider.setPaymentStatus(result.providerPaymentIntentId, 'cancelled');
    assert.equal(await provider.getPaymentStatus(result.providerPaymentIntentId), 'cancelled');
  });

  it('issues refunds through the provider adapter', async () => {
    const refund = await provider.createRefund({
      providerPaymentIntentId: 'pi_mock_refund',
      amountCents: 7500,
      idempotencyKey: 'refund-1',
    });
    assert.match(refund.providerRefundId, /^re_mock_/);
  });
});
