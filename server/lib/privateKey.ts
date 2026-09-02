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

function compactEnv(value: string): string {
  return unwrapQuotes(value).replace(/\s+/g, '');
}

function decodeBase64Buffer(value: string): Buffer {
  return Buffer.from(compactEnv(value), 'base64');
}

function decodeMaybeUtf16(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le');
  }
  if (buf.length >= 4 && buf[0] === 0x7b && buf[1] === 0x00) {
    return buf.toString('utf16le');
  }
  return buf.toString('utf8');
}

function pemFromDer(der: Buffer): string | null {
  if (der.length < 32 || der[0] !== 0x30) return null;
  const body = der.toString('base64');
  const pem = `-----BEGIN PRIVATE KEY-----\n${wrapPemLines(body)}\n-----END PRIVATE KEY-----\n`;
  try {
    createPrivateKey(pem);
    return pem;
  } catch {
    return null;
  }
}

function wrapPemLines(body: string): string {
  const lines: string[] = [];
  for (let index = 0; index < body.length; index += 64) {
    lines.push(body.slice(index, index + 64));
  }
  return lines.join('\n');
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
  return wrapPemLines(compactPemBody(body));
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
    const compact = key.replace(/\s+/g, '').replace(/^n+(?=MII)/, '');
    if (compact.startsWith('MII')) {
      const pem = `-----BEGIN PRIVATE KEY-----\n${wrapPemBody(compact)}\n-----END PRIVATE KEY-----\n`;
      createPrivateKey(pem);
      return pem;
    }
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

function resolveEncodedBlob(
  raw: string,
  preferJson: boolean,
): ResolvedServiceAccount {
  const unwrapped = unescapeNewlines(unwrapQuotes(raw));
  if (preferJson && unwrapQuotes(unwrapped).startsWith('{')) {
    return resolveEncodedBlob(Buffer.from(unwrapped, 'utf8').toString('base64'), true);
  }
  if (BEGIN.test(unwrapped)) {
    const privateKey = normalizePrivateKey(unwrapped);
    return { privateKey, source: 'private-key-base64', ...inspectNormalizedKey(privateKey) };
  }

  const compact = compactEnv(raw).replace(/^n+(?=MII)/, '');
  if (compact.startsWith('MII')) {
    const privateKey = normalizePrivateKey(compact);
    return { privateKey, source: 'private-key-base64', ...inspectNormalizedKey(privateKey) };
  }

  const buf = decodeBase64Buffer(compact);
  const text = unwrapQuotes(decodeMaybeUtf16(buf));

  if (preferJson && text.startsWith('{')) {
    let parsed: { private_key?: string; project_id?: string; client_email?: string };
    try {
      parsed = parseServiceAccountJson(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_BASE64 JSON is invalid (${message.slice(0, 80)})`);
    }
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

  if (BEGIN.test(text) || compact.startsWith('MII')) {
    const privateKey = normalizePrivateKey(BEGIN.test(text) ? text : compact);
    return { privateKey, source: 'private-key-base64', ...inspectNormalizedKey(privateKey) };
  }

  const fromDer = pemFromDer(buf);
  if (fromDer) {
    return { privateKey: fromDer, source: 'private-key-base64', ...inspectNormalizedKey(fromDer) };
  }

  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT_BASE64 did not decode to JSON. You likely pasted the private_key (MII…) instead of the encoded .json file. Run: node scripts/encode-firebase-key.mjs ./serviceAccount.json — the value must start with eyJ.',
  );
}

export function resolveServiceAccount(): ResolvedServiceAccount | null {
  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (serviceAccountB64) {
    return resolveEncodedBlob(serviceAccountB64, true);
  }

  const keyB64 = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  if (keyB64) {
    return resolveEncodedBlob(keyB64, false);
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
