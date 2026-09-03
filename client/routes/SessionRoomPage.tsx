import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  SESSION_STATUS,
  USER_ROLE,
  canJoinSession,
  isPairingMember,
  sessionJoinWindow,
  type MentorshipRelationship,
  type MentorshipSession,
  type SessionJoinPayload,
} from '@apprentorbay/shared';
import { Badge, Button, Card, Cluster, Page, Stack, Text } from '../components';
import { formatDuration, formatSessionDateTime, sessionStatusTone } from '../features/sessions';
import { watchLearnerProfile, watchMentorProfile } from '../features/profiles';
import { watchRelationship } from '../features/mentorship';
import {
  completeMentorshipSession,
  getMentorshipSession,
  joinMentorshipSession,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { JitsiMeetingEmbed } from '../features/sessions/JitsiMeetingEmbed';

export function SessionRoomPage() {
  const { relationshipId, sessionId } = useParams<{
    relationshipId: string;
    sessionId: string;
  }>();
  const navigate = useNavigate();
  const { account } = useAuth();
  const [denied, setDenied] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inMeeting, setInMeeting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [joinConfig, setJoinConfig] = useState<SessionJoinPayload | null>(null);
  const [session, setSession] = useState<MentorshipSession | null>(null);
  const [relationship, setRelationship] = useState<MentorshipRelationship | null | undefined>(
    undefined,
  );
  const [learnerName, setLearnerName] = useState('Learner');
  const [mentorName, setMentorName] = useState('Mentor');

  const workspacePath =
    relationshipId ? `/dashboard/mentorships/${relationshipId}` : '/dashboard/mentorships';

  useEffect(() => {
    if (!relationshipId || !account) return;
    return watchRelationship(
      relationshipId,
      (next) => {
        if (!next) {
          setMissing(true);
          return;
        }
        if (!isPairingMember(account.uid, next) && account.role !== USER_ROLE.admin) {
          setDenied(true);
          return;
        }
        setRelationship(next);
      },
      () => setDenied(true),
    );
  }, [account, relationshipId]);

  useEffect(() => {
    if (!relationship) return;
    const unsubLearner = watchLearnerProfile(relationship.learnerId, (profile) => {
      if (profile?.displayName) setLearnerName(profile.displayName);
    });
    const unsubMentor = watchMentorProfile(relationship.mentorId, (profile) => {
      if (profile?.displayName) setMentorName(profile.displayName);
    });
    return () => {
      unsubLearner();
      unsubMentor();
    };
  }, [relationship]);

  useEffect(() => {
    if (!sessionId || !account || denied || missing) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getMentorshipSession(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        if (relationshipId && loaded.relationshipId !== relationshipId) {
          setDenied(true);
          return;
        }
        setSession(loaded);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this session');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account, denied, missing, relationshipId, sessionId]);

  const leaveMeeting = useCallback(async () => {
    if (!sessionId || leaving) return;
    setLeaving(true);
    setError(null);
    try {
      if (session?.status === SESSION_STATUS.scheduled) {
        await completeMentorshipSession(sessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark the session complete');
    } finally {
      setInMeeting(false);
      setJoinConfig(null);
      setLeaving(false);
      navigate(workspacePath);
    }
  }, [leaving, navigate, session?.status, sessionId, workspacePath]);

  async function startJoin() {
    if (!sessionId || !session || !relationship) return;
    setJoining(true);
    setError(null);
    try {
      const join = await joinMentorshipSession(sessionId);
      setJoinConfig(join);
      setInMeeting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the session');
    } finally {
      setJoining(false);
    }
  }

  const joinWindow = useMemo(
    () => (session ? sessionJoinWindow(session) : null),
    [session],
  );

  if (denied) {
    return <Navigate to="/dashboard/mentorships" replace />;
  }

  if (missing) {
    return (
      <Page>
        <Stack gap={16}>
          <Text variant="h1">Session not found</Text>
          <Button variant="secondary" to="/dashboard/mentorships">
            Back to mentorships
          </Button>
        </Stack>
      </Page>
    );
  }

  if (!account || !sessionId || !relationshipId || loading || !session || !relationship) {
    return (
      <Page>
        <Text variant="muted">Opening session…</Text>
      </Page>
    );
  }

  const joinable =
    session.status === SESSION_STATUS.scheduled &&
    canJoinSession(account, session, relationship);

  return (
    <Page>
      <Stack gap={16}>
        <Cluster gap={12}>
          <Button variant="ghost" size="sm" to={workspacePath}>
            Back to mentorship workspace
          </Button>
        </Cluster>

        {!inMeeting ? (
          <Card padding="lg">
            <Stack gap={16}>
              <Stack gap={8}>
                <Text variant="h1">You're about to join your scheduled mentorship session.</Text>
                <Text variant="muted">
                  Camera and microphone access will be requested when you join. You can mute or turn
                  off video at any time.
                </Text>
              </Stack>

              <div className="grid gap-16 md:grid-cols-2">
                <Stack gap={8}>
                  <Text variant="caption">Mentor</Text>
                  <Text variant="h3">{mentorName}</Text>
                </Stack>
                <Stack gap={8}>
                  <Text variant="caption">Learner</Text>
                  <Text variant="h3">{learnerName}</Text>
                </Stack>
              </div>

              <Stack gap={8}>
                <Text variant="caption">Session</Text>
                <Text variant="h3">{session.title}</Text>
                <Text variant="small">{formatSessionDateTime(session.scheduledStart)}</Text>
                <Text variant="small">{formatDuration(session.durationMinutes)}</Text>
                <Badge tone={sessionStatusTone(session.status)}>{session.status.toUpperCase()}</Badge>
              </Stack>

              {!joinable && joinWindow ? (
                <Text variant="muted">
                  {session.status !== SESSION_STATUS.scheduled
                    ? 'This session is no longer available to join.'
                    : `Join opens ${formatSessionDateTime(joinWindow.opensAt)} and closes ${formatSessionDateTime(joinWindow.closesAt)}.`}
                </Text>
              ) : null}

              {error ? <Text variant="danger">{error}</Text> : null}

              <Cluster gap={8}>
                <Button
                  onClick={() => void startJoin()}
                  loading={joining}
                  disabled={!joinable || leaving}
                >
                  Join now
                </Button>
                <Button variant="secondary" to={workspacePath} disabled={joining || leaving}>
                  Return to workspace
                </Button>
              </Cluster>
            </Stack>
          </Card>
        ) : (
          <Stack gap={12}>
            <Cluster gap={12}>
              <Text variant="h2">{session.title}</Text>
              <Badge tone="accent">LIVE</Badge>
            </Cluster>
            {joinConfig ? (
              <JitsiMeetingEmbed join={joinConfig} onLeave={() => void leaveMeeting()} />
            ) : null}
            <Cluster gap={8}>
              <Button variant="danger" loading={leaving} onClick={() => void leaveMeeting()}>
                Leave meeting
              </Button>
              <Button variant="secondary" to={workspacePath} disabled={leaving}>
                Return to workspace
              </Button>
            </Cluster>
            {error ? <Text variant="danger">{error}</Text> : null}
          </Stack>
        )}
      </Stack>
    </Page>
  );
}
