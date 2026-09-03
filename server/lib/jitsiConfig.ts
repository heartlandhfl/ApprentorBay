import { normalizePrivateKey } from './privateKey.js';

export class JitsiConfigError extends Error {
  readonly name = 'JitsiConfigError';
}

export interface JitsiAuthConfig {
  domain: string;
  appId: string | null;
  apiKeyId: string | null;
  privateKey: string;
  jwtTtlSeconds: number;
}

const DEFAULT_JWT_TTL_SECONDS = 600;

export function isJaasDomain(domain: string): boolean {
  return domain.includes('8x8.vc');
}

function parseJwtTtlSeconds(): number {
  const raw = process.env.JITSI_JWT_TTL_SECONDS?.trim();
  if (!raw) return DEFAULT_JWT_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_JWT_TTL_SECONDS;
  }
  return parsed;
}

export function resolveJitsiAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): JitsiAuthConfig {
  const domain = env.JITSI_DOMAIN?.trim() || 'meet.jit.si';
  const privateKeyRaw = env.JITSI_PRIVATE_KEY?.trim();
  if (!privateKeyRaw) {
    throw new JitsiConfigError('JITSI_PRIVATE_KEY is required for authenticated video sessions');
  }

  const appId = env.JITSI_APP_ID?.trim() || null;
  const apiKeyId = env.JITSI_API_KEY_ID?.trim() || null;

  if (isJaasDomain(domain)) {
    if (!appId) {
      throw new JitsiConfigError('JITSI_APP_ID is required when JITSI_DOMAIN is a JaaS host');
    }
    if (!apiKeyId) {
      throw new JitsiConfigError('JITSI_API_KEY_ID is required when JITSI_DOMAIN is a JaaS host');
    }
  }

  return {
    domain,
    appId,
    apiKeyId,
    privateKey: normalizePrivateKey(privateKeyRaw),
    jwtTtlSeconds: parseJwtTtlSeconds(),
  };
}
