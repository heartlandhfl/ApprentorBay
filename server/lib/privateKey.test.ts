import assert from 'node:assert/strict';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';
import { normalizePrivateKey, resolveServiceAccount } from './privateKey.js';

function samplePem(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function assertParses(pem: string) {
  assert.doesNotThrow(() => createPrivateKey(pem));
}

describe('normalizePrivateKey', () => {
  it('rebuilds a one-line Hostinger-style key', () => {
    const pem = samplePem();
    const smashed = pem.replace(/\n/g, '');
    assertParses(normalizePrivateKey(smashed));
  });

  it('removes leftover n characters from stripped newlines', () => {
    const pem = samplePem();
    const nWrapped = pem.replace(/\n/g, 'n');
    assertParses(normalizePrivateKey(nWrapped));
  });

  it('expands escaped newlines and surrounding quotes', () => {
    const pem = samplePem();
    const escaped = `"${pem.replace(/\n/g, '\\n')}"`;
    assertParses(normalizePrivateKey(escaped));
  });

  it('reads private_key out of a service-account JSON string', () => {
    const pem = samplePem();
    const json = JSON.stringify({
      client_email: 'firebase-adminsdk@apprentorbay.iam.gserviceaccount.com',
      private_key: pem,
    });
    assertParses(normalizePrivateKey(json));
  });

  it('wraps a bare MII body as PKCS8 PEM', () => {
    const pem = samplePem();
    const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
    assertParses(normalizePrivateKey(body));
  });

  it('normalized n-wrapped bodies start with MII, not nMII', () => {
    const pem = samplePem();
    const nWrapped = pem.replace(/\n/g, 'n');
    const normalized = normalizePrivateKey(nWrapped);
    const body = normalized
      .replace(/-----BEGIN [^-]+-----/, '')
      .replace(/-----END [^-]+-----/, '')
      .replace(/\s+/g, '');
    assert.equal(body.slice(0, 3), 'MII');
    assert.ok(!body.includes('nMII'));
  });
});

describe('resolveServiceAccount', () => {
  const previous = { ...process.env };

  function restoreEnv() {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }

  it('prefers FIREBASE_SERVICE_ACCOUNT_BASE64 over a broken PEM', () => {
    const pem = samplePem();
    const json = JSON.stringify({
      type: 'service_account',
      project_id: 'apprentorbay',
      client_email: 'firebase-adminsdk@apprentorbay.iam.gserviceaccount.com',
      private_key: pem,
    });
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(json, 'utf8').toString('base64');
    process.env.FIREBASE_PRIVATE_KEY = pem.replace(/\n/g, 'n');
    try {
      const account = resolveServiceAccount();
      assert.equal(account?.source, 'service-account-base64');
      assert.equal(account?.projectId, 'apprentorbay');
      assert.match(account?.bodyPrefix ?? '', /^MII/);
      assertParses(account!.privateKey);
    } finally {
      restoreEnv();
    }
  });

  it('treats a pasted MII private-key body as a key, not JSON', () => {
    const pem = samplePem();
    const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = body;
    try {
      const account = resolveServiceAccount();
      assert.equal(account?.source, 'private-key-base64');
      assert.match(account?.bodyPrefix ?? '', /^MII/);
      assertParses(account!.privateKey);
    } finally {
      restoreEnv();
    }
  });

  it('accepts a base64-encoded PEM in FIREBASE_SERVICE_ACCOUNT_BASE64', () => {
    const pem = samplePem();
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(pem, 'utf8').toString('base64');
    try {
      const account = resolveServiceAccount();
      assert.equal(account?.source, 'private-key-base64');
      assertParses(account!.privateKey);
    } finally {
      restoreEnv();
    }
  });
});
