import { createSign } from 'node:crypto';
import type { IsoDateString } from '@apprentorbay/shared';

const DEFAULT_JWT_TTL_SECONDS = 900;

function base64Url(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buffer.toString('base64url');
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

export type JitsiJwtConfig = {
  enabled: boolean;
  appId: string | null;
  keyId: string | null;
  privateKeyPem: string | null;
  ttlSeconds: number;
};

export function readJitsiJwtConfig(): JitsiJwtConfig {
  const appId = process.env.JITSI_APP_ID?.trim() || null;
  const keyId = process.env.JITSI_API_KEY_ID?.trim() || null;
  const privateKeyRaw = process.env.JITSI_PRIVATE_KEY?.trim() || null;
  const privateKeyPem = privateKeyRaw ? normalizePrivateKey(privateKeyRaw) : null;
  const ttlSeconds = Number(process.env.JITSI_JWT_TTL_SECONDS ?? DEFAULT_JWT_TTL_SECONDS);
  return {
    enabled: Boolean(appId && keyId && privateKeyPem),
    appId,
    keyId,
    privateKeyPem,
    ttlSeconds: Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_JWT_TTL_SECONDS,
  };
}

export function signJitsiMeetingJwt(input: {
  roomName: string;
  userId: string;
  displayName: string;
  email: string;
  isModerator: boolean;
  config?: JitsiJwtConfig;
  now?: Date;
}): { jwt: string; expiresAt: IsoDateString } | null {
  const config = input.config ?? readJitsiJwtConfig();
  if (!config.enabled || !config.appId || !config.keyId || !config.privateKeyPem) {
    return null;
  }

  const now = input.now ?? new Date();
  const exp = Math.floor(now.getTime() / 1000) + config.ttlSeconds;
  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: config.appId,
    room: input.roomName,
    exp,
    nbf: Math.floor(now.getTime() / 1000) - 10,
    context: {
      user: {
        id: input.userId,
        name: input.displayName,
        email: input.email,
        moderator: input.isModerator,
      },
    },
  };

  const header = { alg: 'RS256', typ: 'JWT', kid: config.keyId };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(config.privateKeyPem);
  return {
    jwt: `${signingInput}.${base64Url(signature)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
