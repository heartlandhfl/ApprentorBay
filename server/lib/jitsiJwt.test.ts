import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, it } from 'node:test';
import { resolveJitsiAuthConfig } from './jitsiConfig.js';
import { createJitsiRoomToken, resolveJwtRoomName } from './jitsiJwt.js';

function sampleKeyPair() {
  return generateKeyPairSync('rsa', { modulusLength: 2048 });
}

describe('jitsiJwt', () => {
  it('signs a JaaS token with app id room prefix and kid header', () => {
    const { privateKey, publicKey } = sampleKeyPair();
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const config = resolveJitsiAuthConfig({
      JITSI_DOMAIN: '8x8.vc',
      JITSI_APP_ID: 'vpaas-magic-cookie-test',
      JITSI_API_KEY_ID: 'test-kid',
      JITSI_PRIVATE_KEY: pem,
      JITSI_JWT_TTL_SECONDS: '300',
    });

    const token = createJitsiRoomToken(config, 'ab-session-1', {
      displayName: 'Learner',
      email: 'learner@example.com',
    });

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: 'jitsi',
    }) as jwt.JwtPayload;

    assert.equal(decoded.iss, 'chat');
    assert.equal(decoded.sub, 'vpaas-magic-cookie-test');
    assert.equal(decoded.room, 'vpaas-magic-cookie-test/ab-session-1');
    assert.equal(decoded.context?.user?.name, 'Learner');
    assert.equal(decoded.exp! - decoded.nbf!, config.jwtTtlSeconds + 10);
  });

  it('uses the bare room name for self-hosted domains', () => {
    const { privateKey } = sampleKeyPair();
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const config = resolveJitsiAuthConfig({
      JITSI_DOMAIN: 'meet.example.com',
      JITSI_APP_ID: 'apprentorbay',
      JITSI_PRIVATE_KEY: pem,
    });

    assert.equal(resolveJwtRoomName(config, 'ab-session-2'), 'ab-session-2');
    const token = createJitsiRoomToken(config, 'ab-session-2', { displayName: 'Mentor' });
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    assert.equal(decoded.room, 'ab-session-2');
    assert.equal(decoded.sub, 'meet.example.com');
  });
});
