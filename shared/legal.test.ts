import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TERMS_VERSION, needsTermsAcceptance } from './legal.js';

describe('needsTermsAcceptance', () => {
  it('blocks a user who has never accepted', () => {
    assert.equal(
      needsTermsAcceptance({ termsAcceptedAt: null, termsVersion: null }),
      true,
    );
    assert.equal(needsTermsAcceptance({} as { termsAcceptedAt: string | null; termsVersion: string | null }), true);
  });

  it('blocks a user whose stored version is not the current one', () => {
    assert.equal(
      needsTermsAcceptance({
        termsAcceptedAt: '2020-01-01T00:00:00.000Z',
        termsVersion: 'older-than-current',
      }),
      true,
    );
  });

  it('allows a user who accepted the current version', () => {
    assert.equal(
      needsTermsAcceptance({
        termsAcceptedAt: '2026-08-30T12:00:00.000Z',
        termsVersion: TERMS_VERSION,
      }),
      false,
    );
  });

  it('does not apply when there is no signed-in user', () => {
    assert.equal(needsTermsAcceptance(null), false);
    assert.equal(needsTermsAcceptance(undefined), false);
  });
});
