import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { paymentsConfigured, paymentsHealthSnapshot } from './paymentConfig.js';
import { getPaymentService, resetPaymentServiceForTests } from './paymentService.js';
import { getPaymentProvider, resetPaymentProviderForTests } from './registry.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  resetPaymentProviderForTests();
  resetPaymentServiceForTests();
});

describe('payment startup', () => {
  it('does not require Stripe credentials until checkout is invoked', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.NODE_ENV = 'production';

    assert.equal(paymentsConfigured(), false);
    assert.doesNotThrow(() => getPaymentService());
  });

  it('reports payment configuration in the health snapshot', () => {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = 'pk_test_example';

    const snapshot = paymentsHealthSnapshot();
    assert.equal(snapshot.provider, 'stripe');
    assert.equal(snapshot.configured, true);
    assert.equal(snapshot.webhookConfigured, true);
    assert.equal(snapshot.publishableKeyConfigured, true);
  });

  it('throws when Stripe provider is resolved without STRIPE_SECRET_KEY', () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.PAYMENT_PROVIDER = 'stripe';

    assert.throws(() => getPaymentProvider(), /STRIPE_SECRET_KEY is not configured/);
  });
});
