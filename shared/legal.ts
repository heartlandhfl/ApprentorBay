import { TERMS_VERSION } from './legal/terms.js';
import type { User } from './types.js';

export {
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_TITLE,
  TERMS_VERSION,
  type TermsSection,
} from './legal/terms.js';

export function needsTermsAcceptance(
  user: Pick<User, 'termsAcceptedAt' | 'termsVersion'> | null | undefined,
): boolean {
  if (!user) return false;
  if (!user.termsAcceptedAt || !user.termsVersion) return true;
  return user.termsVersion !== TERMS_VERSION;
}
