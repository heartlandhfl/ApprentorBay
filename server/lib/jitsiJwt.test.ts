import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';
import { readJitsiJwtConfig, signJitsiMeetingJwt } from './jitsiJwt.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

describe('jitsi JWT signing', () => {
  it('returns null when JWT env is not configured', () => {
    const result = signJitsiMeetingJwt({
      roomName: 'ab-session-1',
      userId: 'learner-1',
      displayName: 'Learner',
      email: 'learner@example.com',
      isModerator: false,
      config: {
        enabled: false,
        appId: null,
        keyId: null,
        privateKeyPem: null,
        ttlSeconds: 900,
      },
    });
    assert.equal(result, null);
  });

  it('signs a short-lived join token when configured', () => {
    const result = signJitsiMeetingJwt({
      roomName: 'ab-session-1',
      userId: 'learner-1',
      displayName: 'Learner',
      email: 'learner@example.com',
      isModerator: false,
      config: {
        enabled: true,
        appId: 'app-id',
        keyId: 'key-id',
        privateKeyPem,
        ttlSeconds: 120,
      },
      now: new Date('2026-09-03T12:00:00.000Z'),
    });
    assert.ok(result);
    assert.match(result!.jwt, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.equal(result!.expiresAt, '2026-09-03T12:02:00.000Z');
  });

  it('reads config from env when variables are present', () => {
    const original = {
      appId: process.env.JITSI_APP_ID,
      keyId: process.env.JITSI_API_KEY_ID,
      privateKey: process.env.JITSI_PRIVATE_KEY,
    };
    process.env.JITSI_APP_ID = 'app-id';
    process.env.JITSI_API_KEY_ID = 'key-id';
    process.env.JITSI_PRIVATE_KEY = privateKeyPem;
    try {
      const config = readJitsiJwtConfig();
      assert.equal(config.enabled, true);
      assert.equal(config.appId, 'app-id');
    } finally {
      process.env.JITSI_APP_ID = original.appId;
      process.env.JITSI_API_KEY_ID = original.keyId;
      process.env.JITSI_PRIVATE_KEY = original.privateKey;
    }
  });
});
