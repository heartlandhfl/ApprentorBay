export const PROFILE_SLUG = {
  minLength: 3,
  maxLength: 40,
} as const;

export const RESERVED_PROFILE_SLUGS = new Set([
  'admin',
  'api',
  'applications',
  'auth',
  'contracts',
  'dashboard',
  'edit',
  'how-it-works',
  'journey',
  'l',
  'learners',
  'legal',
  'login',
  'm',
  'me',
  'member',
  'mentors',
  'messages',
  'new',
  'private',
  'profile',
  'public',
  'settings',
  'signup',
  'slug',
  'terms',
  'u',
  'users',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export function normalizeSlugInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PROFILE_SLUG.maxLength);
}

export function suggestSlug(displayName: string, fallback = 'member'): string {
  const fromName = normalizeSlugInput(displayName);
  if (fromName.length >= PROFILE_SLUG.minLength && !RESERVED_PROFILE_SLUGS.has(fromName)) {
    return fromName;
  }
  return fallback;
}

export function validateProfileSlug(value: string): SlugValidation {
  const slug = normalizeSlugInput(value);
  if (slug.length < PROFILE_SLUG.minLength) {
    return { ok: false, error: 'Choose a public URL of at least 3 characters' };
  }
  if (slug.length > PROFILE_SLUG.maxLength) {
    return { ok: false, error: 'Public URLs can be at most 40 characters' };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, error: 'Use lowercase letters, numbers, and hyphens only' };
  }
  if (RESERVED_PROFILE_SLUGS.has(slug)) {
    return { ok: false, error: 'That public URL is reserved' };
  }
  if (looksLikeFirebaseUid(slug)) {
    return { ok: false, error: 'That public URL looks like an account id' };
  }
  return { ok: true, slug };
}

export function nextSlugCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  const trimmed = base.slice(0, PROFILE_SLUG.maxLength - suffix.length);
  const candidate = `${trimmed}${suffix}`;
  return candidate.length >= PROFILE_SLUG.minLength ? candidate : `member${suffix}`;
}

export function looksLikeFirebaseUid(value: string): boolean {
  return /^[A-Za-z0-9]{20,36}$/.test(value) && !value.includes('-');
}
