import {
  SESSION_STATUS,
  assertSessionOwnership,
  buildMentorshipSession,
  canJoinSession,
  canCancelSession,
  canCompleteSession,
  canReadSession,
  canScheduleSession,
  canTransitionSession,
  findSchedulingConflict,
  normalizeRelationship,
  normalizeSession,
  validateSessionScheduleInput,
  type MentorshipBooking,
  type MentorshipRelationship,
  type MentorshipSession,
  type SessionJoinPayload,
  type User,
} from '@apprentorbay/shared';

export type SessionServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'conflict';

export class SessionServiceError extends Error {
  readonly code: SessionServiceErrorCode;
  readonly status: number;

  constructor(code: SessionServiceErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface SessionStore {
  getRelationship(relationshipId: string): Promise<MentorshipRelationship | null>;
  getSession(sessionId: string): Promise<MentorshipSession | null>;
  saveSession(session: MentorshipSession): Promise<void>;
  listSessions(relationshipId: string): Promise<MentorshipSession[]>;
  newSessionId(): string;
  getBookingForSession(
    sessionId: string,
  ): Promise<Pick<MentorshipBooking, 'id' | 'paymentStatus' | 'bookingStatus' | 'sessionId'> | null>;
}

export interface CreateSessionInput {
  relationshipId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  mentorId?: unknown;
  learnerId?: unknown;
  roomName?: unknown;
}

function rejectClientOwnershipFields(body: CreateSessionInput): void {
  if (body.mentorId !== undefined) {
    throw new SessionServiceError('forbidden', 'mentorId cannot be set by the client', 403);
  }
  if (body.learnerId !== undefined) {
    throw new SessionServiceError('forbidden', 'learnerId cannot be set by the client', 403);
  }
  if (body.roomName !== undefined) {
    throw new SessionServiceError('forbidden', 'roomName cannot be set by the client', 403);
  }
}

function requireActor(account: User | undefined): User {
  if (!account) {
    throw new SessionServiceError('unauthenticated', 'Sign in required', 401);
  }
  return account;
}

export async function createMentorshipSession(
  store: SessionStore,
  account: User | undefined,
  body: CreateSessionInput,
  now: string = new Date().toISOString(),
): Promise<MentorshipSession> {
  const actor = requireActor(account);
  rejectClientOwnershipFields(body);

  const relationshipId = body.relationshipId?.trim() ?? '';
  if (!relationshipId) {
    throw new SessionServiceError('invalid', 'relationshipId is required', 400);
  }

  const relationship = await store.getRelationship(relationshipId);
  if (!relationship) {
    throw new SessionServiceError('not_found', 'Relationship not found', 404);
  }

  if (!canScheduleSession(actor, relationship)) {
    throw new SessionServiceError(
      'forbidden',
      'You cannot schedule a session for this relationship',
      403,
    );
  }

  const schedule = validateSessionScheduleInput({
    title: typeof body.title === 'string' ? body.title : '',
    scheduledStart: typeof body.scheduledStart === 'string' ? body.scheduledStart : '',
    scheduledEnd: typeof body.scheduledEnd === 'string' ? body.scheduledEnd : '',
    now,
  });
  if (!schedule.ok) {
    throw new SessionServiceError('invalid', schedule.error, 400);
  }

  const existing = await store.listSessions(relationshipId);
  const conflict = findSchedulingConflict(body.scheduledStart, body.scheduledEnd, existing);
  if (conflict) {
    throw new SessionServiceError(
      'conflict',
      'This time overlaps another scheduled session for this mentorship',
      409,
    );
  }

  const sessionId = store.newSessionId();
  const session = buildMentorshipSession({
    id: sessionId,
    relationship,
    title: body.title,
    scheduledStart: body.scheduledStart,
    scheduledEnd: body.scheduledEnd,
    now,
  });

  await store.saveSession(session);
  return session;
}

export async function getMentorshipSession(
  store: SessionStore,
  account: User | undefined,
  sessionId: string,
): Promise<MentorshipSession> {
  const actor = requireActor(account);
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new SessionServiceError('not_found', 'Session not found', 404);
  }
  if (!canReadSession(actor, session)) {
    throw new SessionServiceError('forbidden', 'You cannot view this session', 403);
  }
  return session;
}

export async function listMentorshipSessions(
  store: SessionStore,
  account: User | undefined,
  relationshipId: string,
): Promise<MentorshipSession[]> {
  const actor = requireActor(account);
  const relationship = await store.getRelationship(relationshipId);
  if (!relationship) {
    throw new SessionServiceError('not_found', 'Relationship not found', 404);
  }
  if (!canReadSession(actor, relationship)) {
    throw new SessionServiceError('forbidden', 'You cannot list sessions for this relationship', 403);
  }
  return store.listSessions(relationshipId);
}

export async function cancelMentorshipSession(
  store: SessionStore,
  account: User | undefined,
  sessionId: string,
  now: string = new Date().toISOString(),
): Promise<{ session: MentorshipSession; changed: boolean }> {
  const actor = requireActor(account);
  const current = await store.getSession(sessionId);
  if (!current) {
    throw new SessionServiceError('not_found', 'Session not found', 404);
  }

  const relationship = await store.getRelationship(current.relationshipId);
  if (!relationship || !assertSessionOwnership(relationship, current)) {
    throw new SessionServiceError('forbidden', 'Session does not match its relationship', 403);
  }

  if (!canReadSession(actor, current)) {
    throw new SessionServiceError('forbidden', 'You cannot cancel this session', 403);
  }

  if (current.status === SESSION_STATUS.cancelled) {
    return { session: current, changed: false };
  }

  if (!canCancelSession(actor, current)) {
    throw new SessionServiceError('forbidden', 'You cannot cancel this session', 403);
  }

  if (!canTransitionSession(current.status, SESSION_STATUS.cancelled)) {
    throw new SessionServiceError('conflict', 'This session can no longer be cancelled', 409);
  }

  const session: MentorshipSession = {
    ...current,
    status: SESSION_STATUS.cancelled,
    updatedAt: now,
    cancelledAt: now,
    cancelledById: actor.uid,
  };
  await store.saveSession(session);
  return { session, changed: true };
}

export async function completeMentorshipSession(
  store: SessionStore,
  account: User | undefined,
  sessionId: string,
  now: string = new Date().toISOString(),
): Promise<{ session: MentorshipSession; changed: boolean }> {
  const actor = requireActor(account);
  const current = await store.getSession(sessionId);
  if (!current) {
    throw new SessionServiceError('not_found', 'Session not found', 404);
  }

  const relationship = await store.getRelationship(current.relationshipId);
  if (!relationship || !assertSessionOwnership(relationship, current)) {
    throw new SessionServiceError('forbidden', 'Session does not match its relationship', 403);
  }

  if (!canReadSession(actor, current)) {
    throw new SessionServiceError('forbidden', 'You cannot complete this session', 403);
  }

  if (current.status === SESSION_STATUS.completed) {
    return { session: current, changed: false };
  }

  if (!canCompleteSession(actor, current)) {
    throw new SessionServiceError('forbidden', 'You cannot complete this session', 403);
  }

  if (!canTransitionSession(current.status, SESSION_STATUS.completed)) {
    throw new SessionServiceError('conflict', 'This session can no longer be completed', 409);
  }

  const session: MentorshipSession = {
    ...current,
    status: SESSION_STATUS.completed,
    updatedAt: now,
    startedAt: current.startedAt ?? now,
    endedAt: now,
  };
  await store.saveSession(session);
  return { session, changed: true };
}

export function resolveJitsiDomain(): string {
  return process.env.JITSI_DOMAIN?.trim() || 'meet.jit.si';
}

export async function joinMentorshipSession(
  store: SessionStore,
  account: User | undefined,
  sessionId: string,
  now: string = new Date().toISOString(),
): Promise<SessionJoinPayload> {
  const actor = requireActor(account);
  const current = await store.getSession(sessionId);
  if (!current) {
    throw new SessionServiceError('not_found', 'Session not found', 404);
  }

  const relationship = await store.getRelationship(current.relationshipId);
  if (!relationship || !assertSessionOwnership(relationship, current)) {
    throw new SessionServiceError('forbidden', 'Session does not match its relationship', 403);
  }

  const booking = await store.getBookingForSession(sessionId);

  if (!canJoinSession(actor, current, relationship, booking, now)) {
    throw new SessionServiceError('forbidden', 'You cannot join this session yet', 403);
  }

  if (!current.startedAt) {
    await store.saveSession({
      ...current,
      startedAt: now,
      updatedAt: now,
    });
  }

  return {
    domain: resolveJitsiDomain(),
    roomName: current.roomName,
    userInfo: {
      displayName: actor.displayName?.trim() || 'Participant',
      email: actor.email?.trim() || '',
    },
  };
}

export function relationshipFromStoreData(
  raw: MentorshipRelationship | null,
): MentorshipRelationship | null {
  return raw ? normalizeRelationship(raw) : null;
}

export function sessionFromStoreData(raw: MentorshipSession | null): MentorshipSession | null {
  return raw ? normalizeSession(raw) : null;
}
