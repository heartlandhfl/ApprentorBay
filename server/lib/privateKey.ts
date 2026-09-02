import { createPrivateKey } from 'node:crypto';

const BEGIN = /-----BEGIN ((?:RSA )?PRIVATE KEY)-----/;
const END = /-----END ((?:RSA )?PRIVATE KEY)-----/;

export interface ResolvedServiceAccount {
  privateKey: string;
  projectId?: string;
  clientEmail?: string;
  source: 'private-key' | 'private-key-base64' | 'service-account' | 'service-account-base64';
  bodyPrefix: string;
  bodyLength: number;
}

function unwrapQuotes(value: string): string {
  let next = value.trim().replace(/^\uFEFF/, '');
  for (let pass = 0; pass < 3; pass += 1) {
    if (
      (next.startsWith('"') && next.endsWith('"')) ||
      (next.startsWith("'") && next.endsWith("'"))
    ) {
      next = next.slice(1, -1).trim();
    } else {
      break;
    }
  }
  return next
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u200b/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function unescapeNewlines(value: string): string {
  let next = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (next.includes('\\n')) {
    next = next.replace(/\\n/g, '\n');
  }
  return next.replace(/\\r/g, '');
}

function decodeBase64Env(value: string): string {
  const compact = unwrapQuotes(value).replace(/\s+/g, '');
  return Buffer.from(compact, 'base64').toString('utf8');
}

function parseServiceAccountJson(raw: string): {
  private_key?: string;
  project_id?: string;
  client_email?: string;
} {
  return JSON.parse(unwrapQuotes(raw)) as {
    private_key?: string;
    project_id?: string;
    client_email?: string;
  };
}

function compactPemBody(body: string): string {
  const flattened = body.replace(/\s+/g, '');
  const nWrapped = flattened.replace(/^n+(?=MII)/, '');
  let wraps = 0;
  let slots = 0;
  for (let index = 64; index < nWrapped.length; index += 65) {
    slots += 1;
    if (nWrapped[index] === 'n') wraps += 1;
  }
  const unwrapped =
    slots >= 3 && wraps / slots >= 0.75
      ? nWrapped.replace(/(.{64})n/g, '$1')
      : nWrapped;
  const compact = unwrapped.replace(/n+$/, '');
  if (!compact) {
    throw new Error('FIREBASE_PRIVATE_KEY PEM body is empty');
  }
  if (!compact.startsWith('MII')) {
    throw new Error(
      `FIREBASE_PRIVATE_KEY body should start with MII (got ${compact.slice(0, 4) || 'empty'}). Re-copy private_key or set FIREBASE_PRIVATE_KEY_BASE64.`,
    );
  }
  return compact;
}

function wrapPemBody(body: string): string {
  const compact = compactPemBody(body);
  const lines: string[] = [];
  for (let index = 0; index < compact.length; index += 64) {
    lines.push(compact.slice(index, index + 64));
  }
  return lines.join('\n');
}

export function normalizePrivateKey(raw: string): string {
  let working = unwrapQuotes(raw);
  if (working.startsWith('{')) {
    const parsed = parseServiceAccountJson(working);
    if (!parsed.private_key) {
      throw new Error('Service account JSON is missing private_key');
    }
    working = parsed.private_key;
  }
  const key = unescapeNewlines(unwrapQuotes(working));

  const begin = BEGIN.exec(key);
  const end = END.exec(key);
  if (!begin || !end) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY must be the PEM private_key from the Firebase JSON, or set FIREBASE_PRIVATE_KEY_BASE64',
    );
  }
  if (begin[1] !== end[1]) {
    throw new Error('FIREBASE_PRIVATE_KEY BEGIN/END labels do not match');
  }

  const start = key.indexOf(begin[0]) + begin[0].length;
  const stop = key.indexOf(end[0], start);
  const body = wrapPemBody(key.slice(start, stop));
  const pem = `-----BEGIN ${begin[1]}-----\n${body}\n-----END ${end[1]}-----\n`;
  createPrivateKey(pem);
  return pem;
}

export function inspectNormalizedKey(pem: string): { bodyPrefix: string; bodyLength: number } {
  const begin = BEGIN.exec(pem);
  const end = END.exec(pem);
  if (!begin || !end) return { bodyPrefix: '', bodyLength: 0 };
  const start = pem.indexOf(begin[0]) + begin[0].length;
  const stop = pem.indexOf(end[0], start);
  const compact = pem.slice(start, stop).replace(/\s+/g, '');
  return { bodyPrefix: compact.slice(0, 4), bodyLength: compact.length };
}

export function configuredKeySource(): ResolvedServiceAccount['source'] | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim()) return 'service-account-base64';
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim()) return 'private-key-base64';
  if (process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    return 'service-account';
  }
  if (process.env.FIREBASE_PRIVATE_KEY?.trim()) return 'private-key';
  return null;
}

export function resolveServiceAccount(): ResolvedServiceAccount | null {
  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (serviceAccountB64) {
    const parsed = parseServiceAccountJson(decodeBase64Env(serviceAccountB64));
    if (!parsed.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 JSON is missing private_key');
    }
    const privateKey = normalizePrivateKey(parsed.private_key);
    return {
      privateKey,
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      source: 'service-account-base64',
      ...inspectNormalizedKey(privateKey),
    };
  }

  const keyB64 = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  if (keyB64) {
    const privateKey = normalizePrivateKey(decodeBase64Env(keyB64));
    return { privateKey, source: 'private-key-base64', ...inspectNormalizedKey(privateKey) };
  }

  const serviceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount?.trim()) {
    const parsed = parseServiceAccountJson(serviceAccount);
    if (!parsed.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT JSON is missing private_key');
    }
    const privateKey = normalizePrivateKey(parsed.private_key);
    return {
      privateKey,
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      source: 'service-account',
      ...inspectNormalizedKey(privateKey),
    };
  }

  const key = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (!key) return null;
  const privateKey = normalizePrivateKey(key);
  return { privateKey, source: 'private-key', ...inspectNormalizedKey(privateKey) };
}
