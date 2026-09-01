import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';
import { createPrivateKey } from 'node:crypto';
import { normalizePrivateKey } from './privateKey.js';

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
    const normalized = normalizePrivateKey(smashed);
    assert.match(normalized, /BEGIN PRIVATE KEY/);
    assert.notEqual(normalized, smashed);
    assertParses(normalized);
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
});
