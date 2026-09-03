import { isPairingMember, type MentorshipRelationship, type PairingMemberIds } from './relationships.js';
import { SESSION_STATUS, isSessionStatus, type SessionStatus } from './statuses.js';
import type { IsoDateString } from './users.js';

/** Persisted as `mentorshipSessions`. Scoped to one mentorship relationship. */
export interface MentorshipSession {
  id: string;
  relationshipId: string;
  mentorId: string;
  learnerId: string;
  title: string;
  scheduledStart: IsoDateString;
  scheduledEnd: IsoDateString;
  durationMinutes: number;
  roomName: string;
  status: SessionStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  startedAt: IsoDateString | null;
  endedAt: IsoDateString | null;
  cancelledAt: IsoDateString | null;
  cancelledById: string | null;
}

export const SESSION_SCHEDULE = {
  minDurationMinutes: 15,
  maxDurationMinutes: 180,
  maxTitleLength: 120,
  maxHorizonDays: 90,
  joinEarlyMinutes: 10,
  joinGraceMinutes: 15,
} as const;

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  [SESSION_STATUS.scheduled]: 'SCHEDULED',
  [SESSION_STATUS.cancelled]: 'CANCELLED',
  [SESSION_STATUS.completed]: 'COMPLETED',
};

/** Opaque Jitsi room slug — no PII, derived from server-generated session id. */
export function buildSessionRoomName(sessionId: string): string {
  const id = sessionId.trim();
  if (!id) {
    throw new Error('sessionId is required to build a room name');
  }
  return `ab-${id}`;
}

export function durationMinutesBetween(start: IsoDateString, end: IsoDateString): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0;
  }
  return Math.round((endMs - startMs) / 60_000);
}

export function isTerminalSessionStatus(status: SessionStatus): boolean {
  return status === SESSION_STATUS.cancelled || status === SESSION_STATUS.completed;
}

export function isLiveSession(session: Pick<MentorshipSession, 'status' | 'startedAt' | 'endedAt'>): boolean {
  return (
    session.status === SESSION_STATUS.scheduled &&
    session.startedAt !== null &&
    session.endedAt === null
  );
}

export function sessionJoinWindow(
  session: Pick<MentorshipSession, 'scheduledStart' | 'scheduledEnd'>,
  now: IsoDateString = new Date().toISOString(),
): { opensAt: IsoDateString; closesAt: IsoDateString; joinable: boolean } {
  const startMs = Date.parse(session.scheduledStart);
  const endMs = Date.parse(session.scheduledEnd);
  const nowMs = Date.parse(now);
  const opensAt = new Date(startMs - SESSION_SCHEDULE.joinEarlyMinutes * 60_000).toISOString();
  const closesAt = new Date(endMs + SESSION_SCHEDULE.joinGraceMinutes * 60_000).toISOString();
  const joinable = nowMs >= Date.parse(opensAt) && nowMs <= Date.parse(closesAt);
  return { opensAt, closesAt, joinable };
}

export function pairingMatchesSession(
  pairing: PairingMemberIds,
  session: Pick<MentorshipSession, 'learnerId' | 'mentorId'>,
): boolean {
  return pairing.learnerId === session.learnerId && pairing.mentorId === session.mentorId;
}

export function buildMentorshipSession(input: {
  id: string;
  relationship: Pick<MentorshipRelationship, 'id' | 'learnerId' | 'mentorId'>;
  title: string;
  scheduledStart: IsoDateString;
  scheduledEnd: IsoDateString;
  now: IsoDateString;
}): MentorshipSession {
  const durationMinutes = durationMinutesBetween(input.scheduledStart, input.scheduledEnd);
  return {
    id: input.id,
    relationshipId: input.relationship.id,
    mentorId: input.relationship.mentorId,
    learnerId: input.relationship.learnerId,
    title: input.title.trim(),
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    durationMinutes,
    roomName: buildSessionRoomName(input.id),
    status: SESSION_STATUS.scheduled,
    createdAt: input.now,
    updatedAt: input.now,
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    cancelledById: null,
  };
}

export function normalizeSession(
  raw: Partial<MentorshipSession> & { id?: string },
): MentorshipSession {
  const createdAt = raw.createdAt ?? '';
  const status = isSessionStatus(raw.status) ? raw.status : SESSION_STATUS.scheduled;
  const id = raw.id ?? '';
  return {
    id,
    relationshipId: raw.relationshipId ?? '',
    mentorId: raw.mentorId ?? '',
    learnerId: raw.learnerId ?? '',
    title: raw.title ?? '',
    scheduledStart: raw.scheduledStart ?? createdAt,
    scheduledEnd: raw.scheduledEnd ?? createdAt,
    durationMinutes: raw.durationMinutes ?? 0,
    roomName: raw.roomName ?? (id ? buildSessionRoomName(id) : ''),
    status,
    createdAt,
    updatedAt: raw.updatedAt ?? createdAt,
    startedAt: raw.startedAt ?? null,
    endedAt: raw.endedAt ?? null,
    cancelledAt: raw.cancelledAt ?? (status === SESSION_STATUS.cancelled ? raw.updatedAt ?? null : null),
    cancelledById: raw.cancelledById ?? null,
  };
}

export function assertSessionOwnership(
  relationship: Pick<MentorshipRelationship, 'id' | 'learnerId' | 'mentorId'>,
  session: Pick<MentorshipSession, 'relationshipId' | 'learnerId' | 'mentorId'>,
): boolean {
  if (session.relationshipId !== relationship.id) return false;
  return pairingMatchesSession(relationship, session);
}

export function isSessionMember(uid: string, session: PairingMemberIds): boolean {
  return isPairingMember(uid, session);
}
