import type { PaymentProviderId } from '@apprentorbay/shared';

export type ProviderWebhookEvent =
  | {
      type: 'payment_processing';
      providerPaymentIntentId: string;
      providerEventId: string;
    }
  | {
      type: 'payment_succeeded';
      providerPaymentIntentId: string;
      paidAt: string;
      providerChargeId?: string;
      providerEventId: string;
    }
  | {
      type: 'payment_failed';
      providerPaymentIntentId: string;
      failureCode?: string;
      failureMessage?: string;
      providerEventId: string;
    }
  | {
      type: 'payment_cancelled';
      providerPaymentIntentId: string;
      providerEventId: string;
    }
  | {
      type: 'checkout_completed';
      providerCheckoutSessionId: string;
      providerEventId: string;
    }
  | {
      type: 'checkout_expired';
      providerCheckoutSessionId: string;
      providerEventId: string;
    }
  | {
      type: 'refund_succeeded';
      providerRefundId: string;
      providerPaymentIntentId: string;
      amountCents: number;
      providerEventId: string;
    }
  | {
      type: 'refund_failed';
      providerRefundId: string;
      providerEventId: string;
    };

export interface CreateProviderCheckoutInput {
  paymentIntentId: string;
  bookingId: string;
  amountCents: number;
  currency: 'USD';
  title: string;
  learnerId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface ProviderCheckoutResult {
  providerCheckoutSessionId: string;
  providerPaymentIntentId: string;
  checkoutUrl: string;
  expiresAt: string;
}

export type ProviderPaymentStatus = 'processing' | 'paid' | 'failed' | 'cancelled';

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckoutSession(input: CreateProviderCheckoutInput): Promise<ProviderCheckoutResult>;
  verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<ProviderWebhookEvent[]>;
  getPaymentStatus(providerPaymentIntentId: string): Promise<ProviderPaymentStatus>;
  createRefund(input: {
    providerPaymentIntentId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ providerRefundId: string }>;
}
