import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { PAYMENT_PROVIDER_ID } from '@apprentorbay/shared';
import { assertPaymentProviderAllowedForEnvironment } from './paymentConfig.js';
import { getPaymentProvider, resetPaymentProviderForTests } from './registry.js';

describe('payment provider environment guard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPaymentProvider = process.env.PAYMENT_PROVIDER;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalPaymentProvider === undefined) {
      delete process.env.PAYMENT_PROVIDER;
    } else {
      process.env.PAYMENT_PROVIDER = originalPaymentProvider;
    }
    resetPaymentProviderForTests();
  });

  it('refuses mock provider when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_PROVIDER = PAYMENT_PROVIDER_ID.mock;

    assert.throws(
      () => assertPaymentProviderAllowedForEnvironment(),
      /PAYMENT_PROVIDER=mock is not allowed when NODE_ENV=production/,
    );
  });

  it('getPaymentProvider enforces the production mock guard', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_PROVIDER = PAYMENT_PROVIDER_ID.mock;

    assert.throws(
      () => getPaymentProvider(),
      /PAYMENT_PROVIDER=mock is not allowed when NODE_ENV=production/,
    );
  });

  it('allows mock provider outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_PROVIDER = PAYMENT_PROVIDER_ID.mock;

    assert.doesNotThrow(() => assertPaymentProviderAllowedForEnvironment());
    assert.equal(getPaymentProvider().id, PAYMENT_PROVIDER_ID.mock);
  });

  it('allows stripe provider in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_PROVIDER = PAYMENT_PROVIDER_ID.stripe;

    assert.doesNotThrow(() => assertPaymentProviderAllowedForEnvironment());
  });
});
