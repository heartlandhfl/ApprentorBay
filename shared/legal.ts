import {
  TERMS_CONFIG,
  TERMS_EFFECTIVE_DATE,
  TERMS_VERSION,
} from './legal/terms.js';
import type { User } from './types.js';

export {
  TERMS_ACCEPTANCE_LABEL,
  TERMS_CONFIG,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_TITLE,
  TERMS_VERSION,
  type TermsSection,
} from './legal/terms.js';

export type TermsEffectiveStatus = 'upcoming' | 'in_effect';

export type TermsAcceptanceRecord = {
  termsAccepted: true;
  termsVersion: string;
  termsAcceptedAt: string;
};

export type TermsAcceptanceInput = {
  accepted?: boolean;
  version?: string | null;
  acceptedAt?: string | null;
};

export function termsEffectiveStartUtc(): Date {
  return new Date(`${TERMS_EFFECTIVE_DATE}T00:00:00.000Z`);
}

export function termsEffectiveStatus(now: Date = new Date()): TermsEffectiveStatus {
  return now.getTime() >= termsEffectiveStartUtc().getTime() ? 'in_effect' : 'upcoming';
}

export function formatTermsEffectiveDate(): string {
  const [year, month, day] = TERMS_EFFECTIVE_DATE.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Public caption for the Effective Date. Future terms are never described
 * as already in force.
 */
export function termsEffectiveLabel(now: Date = new Date()): string {
  const date = formatTermsEffectiveDate();
  if (termsEffectiveStatus(now) === 'in_effect') {
    return `Effective ${date}. Version ${TERMS_VERSION}.`;
  }
  return `These Terms take effect on ${date}. They are not yet in force. Version ${TERMS_VERSION}.`;
}

export function isValidTermsAcceptance(input: TermsAcceptanceInput): boolean {
  return (
    input.accepted === true &&
    input.version === TERMS_VERSION &&
    typeof input.acceptedAt === 'string' &&
    input.acceptedAt.trim().length > 0 &&
    !Number.isNaN(Date.parse(input.acceptedAt))
  );
}

export function termsAcceptanceFromUser(
  user: Pick<User, 'termsAccepted' | 'termsAcceptedAt' | 'termsVersion'> | null | undefined,
): TermsAcceptanceInput {
  return {
    accepted: user?.termsAccepted,
    version: user?.termsVersion ?? null,
    acceptedAt: user?.termsAcceptedAt ?? null,
  };
}

export function validateSignupTermsAcceptance(input: { accepted?: boolean }): {
  ok: boolean;
  error?: string;
} {
  if (input.accepted !== true) {
    return {
      ok: false,
      error: 'You must confirm that you are legally eligible and agree to the Terms of Use.',
    };
  }
  return { ok: true };
}

export function buildTermsAcceptance(now: string): TermsAcceptanceRecord {
  return {
    termsAccepted: true,
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: now,
  };
}

export function needsTermsAcceptance(
  user: Pick<User, 'termsAccepted' | 'termsAcceptedAt' | 'termsVersion'> | null | undefined,
): boolean {
  if (!user) return false;
  return !isValidTermsAcceptance(termsAcceptanceFromUser(user));
}
