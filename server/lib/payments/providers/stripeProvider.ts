import Stripe from 'stripe';
import { PAYMENT_PROVIDER_ID } from '@apprentorbay/shared';
import {
  paymentCheckoutCancelUrl,
  paymentCheckoutSuccessUrl,
  stripeSecretKeyFromEnv,
  stripeWebhookSecretFromEnv,
} from '../paymentConfig.js';
import type {
  CreateProviderCheckoutInput,
  PaymentProvider,
  ProviderCheckoutResult,
  ProviderPaymentStatus,
  ProviderWebhookEvent,
} from '../types.js';

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

export class StripePaymentProvider implements PaymentProvider {
  readonly id = PAYMENT_PROVIDER_ID.stripe;
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(input: CreateProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        currency: 'usd',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: input.amountCents,
              product_data: {
                name: input.title.slice(0, 250),
              },
            },
          },
        ],
        client_reference_id: input.bookingId,
        success_url: paymentCheckoutSuccessUrl(input.bookingId),
        cancel_url: paymentCheckoutCancelUrl(input.bookingId),
        metadata: {
          ...input.metadata,
          apprentorbay_payment_intent_id: input.paymentIntentId,
          apprentorbay_booking_id: input.bookingId,
          apprentorbay_learner_id: input.learnerId,
        },
        payment_intent_data: {
          metadata: {
            ...input.metadata,
            apprentorbay_payment_intent_id: input.paymentIntentId,
            apprentorbay_booking_id: input.bookingId,
            apprentorbay_learner_id: input.learnerId,
          },
        },
      },
      { idempotencyKey: input.idempotencyKey },
    );

    const providerPaymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? '';

    if (!session.url || !providerPaymentIntentId) {
      throw new Error('Stripe checkout session did not return a redirect URL');
    }

    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return {
      providerCheckoutSessionId: session.id,
      providerPaymentIntentId,
      checkoutUrl: session.url,
      expiresAt,
    };
  }

  async verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<ProviderWebhookEvent[]> {
    const secret = stripeWebhookSecretFromEnv();
    if (!secret) {
      throw Object.assign(new Error('Stripe webhook secret is not configured'), { status: 500 });
    }

    const signature = headerValue(headers, 'stripe-signature');
    if (!signature) {
      throw Object.assign(new Error('Missing Stripe signature'), { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw Object.assign(new Error('Invalid Stripe webhook signature'), { status: 400 });
    }

    return mapStripeEvent(event);
  }

  async getPaymentStatus(providerPaymentIntentId: string): Promise<ProviderPaymentStatus> {
    const intent = await this.stripe.paymentIntents.retrieve(providerPaymentIntentId);
    switch (intent.status) {
      case 'succeeded':
        return 'paid';
      case 'canceled':
        return 'cancelled';
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
      case 'processing':
        return 'processing';
      default:
        return 'failed';
    }
  }

  async createRefund(input: {
    providerPaymentIntentId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ providerRefundId: string }> {
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: input.providerPaymentIntentId,
        amount: input.amountCents,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { providerRefundId: refund.id };
  }
}

function mapStripeEvent(event: Stripe.Event): ProviderWebhookEvent[] {
  switch (event.type) {
    case 'payment_intent.processing':
      return [
        {
          type: 'payment_processing',
          providerPaymentIntentId: readPaymentIntentId(event),
          providerEventId: event.id,
        },
      ];
    case 'payment_intent.succeeded':
      return [
        {
          type: 'payment_succeeded',
          providerPaymentIntentId: readPaymentIntentId(event),
          paidAt: new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          providerChargeId: readLatestChargeId(event.data.object as Stripe.PaymentIntent),
          providerEventId: event.id,
        },
      ];
    case 'payment_intent.payment_failed': {
      const object = event.data.object as Stripe.PaymentIntent;
      const failure = object.last_payment_error;
      return [
        {
          type: 'payment_failed',
          providerPaymentIntentId: object.id,
          failureCode: failure?.code ?? undefined,
          failureMessage: failure?.message ?? undefined,
          providerEventId: event.id,
        },
      ];
    }
    case 'payment_intent.canceled':
      return [
        {
          type: 'payment_cancelled',
          providerPaymentIntentId: readPaymentIntentId(event),
          providerEventId: event.id,
        },
      ];
    case 'checkout.session.completed':
      return [
        {
          type: 'checkout_completed',
          providerCheckoutSessionId: (event.data.object as Stripe.Checkout.Session).id,
          providerEventId: event.id,
        },
      ];
    case 'checkout.session.expired':
      return [
        {
          type: 'checkout_expired',
          providerCheckoutSessionId: (event.data.object as Stripe.Checkout.Session).id,
          providerEventId: event.id,
        },
      ];
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const providerPaymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id ?? '';
      return [
        {
          type: 'refund_succeeded',
          providerRefundId: charge.refunds?.data[0]?.id ?? event.id,
          providerPaymentIntentId,
          amountCents: charge.amount_refunded ?? 0,
          providerEventId: event.id,
        },
      ];
    }
    default:
      return [];
  }
}

function readLatestChargeId(intent: Stripe.PaymentIntent): string | undefined {
  const latest = intent.latest_charge;
  if (!latest) return undefined;
  return typeof latest === 'string' ? latest : latest.id;
}

function readPaymentIntentId(event: Stripe.Event): string {
  const object = event.data.object as Stripe.PaymentIntent;
  return object.id;
}

export function createStripePaymentProvider(): StripePaymentProvider {
  const secretKey = stripeSecretKeyFromEnv();
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new StripePaymentProvider(secretKey);
}
