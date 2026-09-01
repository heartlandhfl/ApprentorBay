const BEGIN = /-----BEGIN ((?:RSA )?PRIVATE KEY)-----/;
const END = /-----END ((?:RSA )?PRIVATE KEY)-----/;

function unwrapQuotes(value: string): string {
  let next = value.trim();
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1);
  }
  return next.trim();
}

function unescapeNewlines(value: string): string {
  let next = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (next.includes('\\n')) {
    next = next.replace(/\\n/g, '\n');
  }
  return next.replace(/\\r/g, '');
}

function extractFromServiceAccount(raw: string): string | null {
  const trimmed = unwrapQuotes(raw);
  if (!trimmed.startsWith('{')) return null;
  const parsed = JSON.parse(trimmed) as { private_key?: string };
  if (!parsed.private_key || typeof parsed.private_key !== 'string') {
    throw new Error('Service account JSON is missing private_key');
  }
  return parsed.private_key;
}

function wrapPemBody(body: string): string {
  const compact = body.replace(/\s+/g, '');
  if (!compact) {
    throw new Error('FIREBASE_PRIVATE_KEY PEM body is empty');
  }
  const lines: string[] = [];
  for (let index = 0; index < compact.length; index += 64) {
    lines.push(compact.slice(index, index + 64));
  }
  return lines.join('\n');
}

/** Rebuild a PKCS#8 / PKCS#1 PEM so Hostinger env vars (stripped or escaped newlines) still parse. */
export function normalizePrivateKey(raw: string): string {
  const fromJson = extractFromServiceAccount(raw);
  let key = unescapeNewlines(unwrapQuotes(fromJson ?? raw));

  const begin = BEGIN.exec(key);
  const end = END.exec(key);
  if (!begin || !end) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY must be the PEM private_key from the Firebase service account JSON',
    );
  }
  if (begin[1] !== end[1]) {
    throw new Error('FIREBASE_PRIVATE_KEY BEGIN/END labels do not match');
  }

  const start = key.indexOf(begin[0]) + begin[0].length;
  const stop = key.indexOf(end[0], start);
  const body = wrapPemBody(key.slice(start, stop));
  return `-----BEGIN ${begin[1]}-----\n${body}\n-----END ${end[1]}-----\n`;
}

export function resolvePrivateKeyInput(): string | null {
  const serviceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount?.trim()) {
    const fromJson = extractFromServiceAccount(serviceAccount);
    if (fromJson) return fromJson;
  }
  const key = process.env.FIREBASE_PRIVATE_KEY?.trim();
  return key || null;
}
