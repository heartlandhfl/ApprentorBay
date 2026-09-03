import { generateKeyPairSync } from 'node:crypto';

let cachedPem: string | null = null;

export function testJitsiPrivateKeyPem(): string {
  if (!cachedPem) {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    cachedPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  }
  return cachedPem;
}

export function applyTestJitsiEnv(env: NodeJS.ProcessEnv = process.env): void {
  env.JITSI_DOMAIN = '8x8.vc';
  env.JITSI_APP_ID = 'vpaas-magic-cookie-test';
  env.JITSI_API_KEY_ID = 'test-api-key-id';
  env.JITSI_PRIVATE_KEY = testJitsiPrivateKeyPem();
  env.JITSI_JWT_TTL_SECONDS = '600';
}
