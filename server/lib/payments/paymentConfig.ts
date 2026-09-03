import { PAYMENT_PROVIDER_ID } from '@apprentorbay/shared';

const MOCK_PROVIDER_FORBIDDEN_IN_PRODUCTION =
  'PAYMENT_PROVIDER=mock is not allowed when NODE_ENV=production';

export function paymentProviderIdFromEnv(): string {
  return (process.env.PAYMENT_PROVIDER ?? PAYMENT_PROVIDER_ID.stripe).trim();
}

export function assertPaymentProviderAllowedForEnvironment(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    paymentProviderIdFromEnv() === PAYMENT_PROVIDER_ID.mock
  ) {
    throw new Error(MOCK_PROVIDER_FORBIDDEN_IN_PRODUCTION);
  }
}

export function stripeSecretKeyFromEnv(): string | null {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  return value ? value : null;
}

export function stripeWebhookSecretFromEnv(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return value ? value : null;
}

export function paymentCheckoutSuccessUrl(bookingId: string): string {
  const base = clientOriginFromEnv();
  return `${base}/bookings/${encodeURIComponent(bookingId)}/payment/return?session_id={CHECKOUT_SESSION_ID}`;
}

export function paymentCheckoutCancelUrl(bookingId: string): string {
  const base = clientOriginFromEnv();
  return `${base}/bookings/${encodeURIComponent(bookingId)}/payment/cancel`;
}

export function clientOriginFromEnv(): string {
  const origin = process.env.CLIENT_ORIGIN?.trim();
  if (origin) return origin.replace(/\/$/, '');
  return process.env.NODE_ENV === 'production' ? 'https://apprentorbay.com' : 'http://localhost:5173';
}

export function paymentsConfigured(): boolean {
  const provider = paymentProviderIdFromEnv();
  if (provider === PAYMENT_PROVIDER_ID.mock) return true;
  if (provider === PAYMENT_PROVIDER_ID.stripe) {
    return Boolean(stripeSecretKeyFromEnv());
  }
  return false;
}
