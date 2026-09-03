/** Maximum base session price in integer cents ($9,999.00). */
export const BASE_SESSION_PRICE_USD = {
  maxCents: 999_900,
} as const;

export function isValidPriceCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

/** Format integer cents as a USD currency string. */
export function formatUsdCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/** Parse a user-entered USD amount (e.g. "75", "75.50", "$1,200") to integer cents. */
export function parseUsdToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isFinite(cents) || cents < 0) return null;
  return cents;
}

/** Convert stored cents to a dollar string for form inputs. */
export function centsToDisplayDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? String(dollars) : dollars.toFixed(2);
}

/**
 * Read session price from persisted mentor fields.
 * New documents store `baseSessionPriceUsd` as integer cents.
 * Legacy documents stored whole dollars in `sessionPriceUsd`.
 */
export function readSessionPriceCents(input: {
  baseSessionPriceUsd?: number | null;
  sessionPriceUsd?: number | null;
}): number | null | undefined {
  if (input.baseSessionPriceUsd !== undefined) {
    return input.baseSessionPriceUsd;
  }
  if (input.sessionPriceUsd !== undefined) {
    if (input.sessionPriceUsd === null) return null;
    if (!Number.isFinite(input.sessionPriceUsd)) return undefined;
    return Math.round(input.sessionPriceUsd * 100);
  }
  return undefined;
}
