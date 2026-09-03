import { PAYMENT_PROVIDER_ID } from '@apprentorbay/shared';
import { paymentProviderIdFromEnv } from './paymentConfig.js';
import { createMockPaymentProvider } from './providers/mockProvider.js';
import { createStripePaymentProvider } from './providers/stripeProvider.js';
import type { PaymentProvider } from './types.js';

let cachedProvider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider;
  const providerId = paymentProviderIdFromEnv();
  if (providerId === PAYMENT_PROVIDER_ID.mock) {
    cachedProvider = createMockPaymentProvider();
    return cachedProvider;
  }
  if (providerId === PAYMENT_PROVIDER_ID.stripe) {
    cachedProvider = createStripePaymentProvider();
    return cachedProvider;
  }
  throw new Error(`Unsupported PAYMENT_PROVIDER: ${providerId}`);
}

export function resetPaymentProviderForTests(): void {
  cachedProvider = null;
}
