import jwt from 'jsonwebtoken';
import { type JitsiAuthConfig, isJaasDomain } from './jitsiConfig.js';

export interface JitsiRoomTokenUser {
  displayName: string;
  email?: string;
}

export function resolveJwtRoomName(config: JitsiAuthConfig, roomName: string): string {
  if (config.appId && isJaasDomain(config.domain)) {
    return `${config.appId}/${roomName}`;
  }
  return roomName;
}

export function createJitsiRoomToken(
  config: JitsiAuthConfig,
  roomName: string,
  userInfo: JitsiRoomTokenUser,
  nowMs: number = Date.now(),
): string {
  const jwtRoom = resolveJwtRoomName(config, roomName);
  const nowSeconds = Math.floor(nowMs / 1000);
  const jaas = config.appId !== null && isJaasDomain(config.domain);

  const payload = {
    aud: 'jitsi',
    iss: jaas ? 'chat' : config.appId ?? 'apprentorbay',
    sub: jaas ? config.appId : config.domain,
    room: jwtRoom,
    nbf: nowSeconds - 10,
    exp: nowSeconds + config.jwtTtlSeconds,
    context: {
      user: {
        name: userInfo.displayName,
        ...(userInfo.email?.trim() ? { email: userInfo.email.trim() } : {}),
      },
    },
  };

  return jwt.sign(payload, config.privateKey, {
    algorithm: 'RS256',
    ...(config.apiKeyId ? { keyid: config.apiKeyId } : {}),
  });
}
