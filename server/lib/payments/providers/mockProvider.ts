import { PAYMENT_PROVIDER_ID } from '@apprentorbay/shared';
import type {
  CreateProviderCheckoutInput,
  PaymentProvider,
  ProviderCheckoutResult,
  ProviderPaymentStatus,
  ProviderWebhookEvent,
} from '../types.js';

const MOCK_SIGNATURE_HEADER = 'x-mock-webhook-signature';
const MOCK_SIGNATURE_VALUE = 'valid';

interface MockState {
  checkouts: Map<string, ProviderCheckoutResult & { status: ProviderPaymentStatus }>;
  refunds: Map<string, { providerPaymentIntentId: string; amountCents: number }>;
}

const globalMockState = (): MockState => {
  const key = '__apprentorbay_mock_payment_state__';
  const existing = (globalThis as Record<string, unknown>)[key] as MockState | undefined;
  if (existing) return existing;
  const created: MockState = { checkouts: new Map(), refunds: new Map() };
  (globalThis as Record<string, unknown>)[key] = created;
  return created;
};

export class MockPaymentProvider implements PaymentProvider {
  readonly id = PAYMENT_PROVIDER_ID.mock;

  async createCheckoutSession(input: CreateProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    const providerCheckoutSessionId = `cs_mock_${input.paymentIntentId}`;
    const providerPaymentIntentId = `pi_mock_${input.paymentIntentId}`;
    const result: ProviderCheckoutResult = {
      providerCheckoutSessionId,
      providerPaymentIntentId,
      checkoutUrl: `https://mock-payments.test/checkout/${providerCheckoutSessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    globalMockState().checkouts.set(providerCheckoutSessionId, {
      ...result,
      status: 'processing',
    });
    return result;
  }

  async verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<ProviderWebhookEvent[]> {
    const signature = headers[MOCK_SIGNATURE_HEADER] ?? headers[MOCK_SIGNATURE_HEADER.toLowerCase()];
    const value = Array.isArray(signature) ? signature[0] : signature;
    if (value !== MOCK_SIGNATURE_VALUE) {
      throw Object.assign(new Error('Invalid mock webhook signature'), { status: 400 });
    }
    const payload = JSON.parse(rawBody.toString('utf8')) as { events: ProviderWebhookEvent[] };
    return payload.events ?? [];
  }

  async getPaymentStatus(providerPaymentIntentId: string): Promise<ProviderPaymentStatus> {
    for (const checkout of globalMockState().checkouts.values()) {
      if (checkout.providerPaymentIntentId === providerPaymentIntentId) {
        return checkout.status;
      }
    }
    return 'processing';
  }

  async createRefund(input: {
    providerPaymentIntentId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ providerRefundId: string }> {
    const providerRefundId = `re_mock_${input.idempotencyKey}`;
    globalMockState().refunds.set(providerRefundId, {
      providerPaymentIntentId: input.providerPaymentIntentId,
      amountCents: input.amountCents,
    });
    return { providerRefundId };
  }

  /** Test helper — not used in production routes. */
  setPaymentStatus(providerPaymentIntentId: string, status: ProviderPaymentStatus): void {
    for (const [key, checkout] of globalMockState().checkouts.entries()) {
      if (checkout.providerPaymentIntentId === providerPaymentIntentId) {
        globalMockState().checkouts.set(key, { ...checkout, status });
      }
    }
  }

  reset(): void {
    globalMockState().checkouts.clear();
    globalMockState().refunds.clear();
  }
}

export function createMockPaymentProvider(): MockPaymentProvider {
  return new MockPaymentProvider();
}

export const MOCK_WEBHOOK_SIGNATURE_HEADER = MOCK_SIGNATURE_HEADER;
export const MOCK_WEBHOOK_SIGNATURE_VALUE = MOCK_SIGNATURE_VALUE;
