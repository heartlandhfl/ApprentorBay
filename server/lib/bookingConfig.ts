import {
  DEFAULT_PLATFORM_FEE_BPS,
} from '@apprentorbay/shared';

export function platformFeeBpsFromEnv(): number {
  const raw = process.env.PLATFORM_FEE_BPS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PLATFORM_FEE_BPS;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    return DEFAULT_PLATFORM_FEE_BPS;
  }
  return parsed;
}
