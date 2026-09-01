import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TERMS_ACCEPTANCE_LABEL,
  TERMS_CONFIG,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
  TERMS_VERSION,
  buildTermsAcceptance,
  isValidTermsAcceptance,
  needsTermsAcceptance,
  termsEffectiveLabel,
  termsEffectiveStatus,
  validateSignupTermsAcceptance,
} from './legal.js';

describe('needsTermsAcceptance', () => {
  it('blocks a user who has never accepted', () => {
    assert.equal(
      needsTermsAcceptance({ termsAcceptedAt: null, termsVersion: null }),
      true,
    );
    assert.equal(
      needsTermsAcceptance({} as { termsAcceptedAt: string | null; termsVersion: string | null }),
      true,
    );
  });

  it('blocks a timestamp-only record without the explicit confirmation', () => {
    assert.equal(
      needsTermsAcceptance({
        termsAcceptedAt: '2026-09-01T12:00:00.000Z',
        termsVersion: TERMS_VERSION,
      }),
      true,
    );
  });

  it('blocks a user whose stored version is not the current one', () => {
    assert.equal(
      needsTermsAcceptance({
        termsAccepted: true,
        termsAcceptedAt: '2020-01-01T00:00:00.000Z',
        termsVersion: 'older-than-current',
      }),
      true,
    );
  });

  it('allows a user who accepted the current version', () => {
    assert.equal(
      needsTermsAcceptance({
        termsAccepted: true,
        termsAcceptedAt: '2026-09-01T12:00:00.000Z',
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

describe('signup terms acceptance', () => {
  it('rejects account creation without the confirmation', () => {
    assert.equal(validateSignupTermsAcceptance({}).ok, false);
    assert.equal(validateSignupTermsAcceptance({ accepted: false }).ok, false);
    assert.equal(isValidTermsAcceptance({ accepted: false, version: TERMS_VERSION, acceptedAt: '2026-09-01T00:00:00.000Z' }), false);
  });

  it('accepts only an explicit confirmation of the current version', () => {
    const check = validateSignupTermsAcceptance({ accepted: true });
    assert.equal(check.ok, true);
    const record = buildTermsAcceptance('2026-09-01T12:00:00.000Z');
    assert.deepEqual(record, {
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: '2026-09-01T12:00:00.000Z',
    });
    assert.equal(isValidTermsAcceptance({ accepted: true, version: record.termsVersion, acceptedAt: record.termsAcceptedAt }), true);
  });

  it('keeps the confirmation wording exact', () => {
    assert.equal(
      TERMS_ACCEPTANCE_LABEL,
      'I confirm that I am legally eligible to use ApprentorBay and agree to the Terms of Use.',
    );
  });
});

describe('terms effective date', () => {
  it('is configurable and is 10 September 2026', () => {
    assert.equal(TERMS_CONFIG.effectiveDate, '2026-09-10');
    assert.equal(TERMS_EFFECTIVE_DATE, '2026-09-10');
    assert.equal(TERMS_VERSION, TERMS_CONFIG.version);
  });

  it('does not describe future terms as already in force', () => {
    const before = new Date('2026-09-01T12:00:00.000Z');
    assert.equal(termsEffectiveStatus(before), 'upcoming');
    assert.match(termsEffectiveLabel(before), /take effect on 10 September 2026/i);
    assert.doesNotMatch(termsEffectiveLabel(before), /^Effective /);
    assert.match(termsEffectiveLabel(before), /not yet in force/i);
  });

  it('describes the Terms as effective on and after the Effective Date', () => {
    const onDay = new Date('2026-09-10T00:00:00.000Z');
    const after = new Date('2026-09-11T00:00:00.000Z');
    assert.equal(termsEffectiveStatus(onDay), 'in_effect');
    assert.equal(termsEffectiveStatus(after), 'in_effect');
    assert.match(termsEffectiveLabel(onDay), /^Effective 10 September 2026/);
  });

  it('publishes complete Terms sections including eligibility and acceptance', () => {
    const headings = TERMS_SECTIONS.map((section) => section.heading);
    assert.ok(headings.some((heading) => /effective date/i.test(heading)));
    assert.ok(headings.some((heading) => /eligibility/i.test(heading)));
    assert.ok(TERMS_SECTIONS.every((section) => !/placeholder/i.test(section.body)));
    assert.ok(TERMS_SECTIONS.some((section) => section.body.includes(TERMS_ACCEPTANCE_LABEL)));
  });
});
