import type { MentorshipSession } from './sessions.js';

/** Session shape returned by API read/list/create/cancel/complete — room name is join-only. */
export type ClientMentorshipSession = Omit<MentorshipSession, 'roomName'>;

export function sanitizeMentorshipSessionForClient(
  session: MentorshipSession,
): ClientMentorshipSession {
  const { roomName: _roomName, ...clientSession } = session;
  return clientSession;
}

export function sanitizeMentorshipSessionsForClient(
  sessions: MentorshipSession[],
): ClientMentorshipSession[] {
  return sessions.map(sanitizeMentorshipSessionForClient);
}
