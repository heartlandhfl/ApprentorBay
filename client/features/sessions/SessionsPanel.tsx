import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SESSION_STATUS,
  SESSION_STATUS_LABEL,
  canCancelSession,
  canJoinSession,
  canScheduleSession,
  isPastSession,
  isUpcomingSession,
  type LearnerProfile,
  type MentorProfile,
  type MentorshipRelationship,
  type MentorshipSession,
  type User,
} from '@apprentorbay/shared';
import { Badge, Button, Card, Cluster, EmptyState, Stack, Table, Text, type TableColumn } from '../../components';
import { cancelMentorshipSession, listMentorshipSessions } from '../../lib/api';
import {
  formatDuration,
  formatSessionDate,
  formatSessionTime,
  sessionStatusTone,
} from './format';
import { ScheduleSessionModal } from './ScheduleSessionModal';

type SessionsPanelProps = {
  relationship: MentorshipRelationship;
  account: User;
  learner: LearnerProfile | null;
  mentor: MentorProfile | null;
};

export function SessionsPanel({
  relationship,
  account,
  learner,
  mentor,
}: SessionsPanelProps) {
  const [sessions, setSessions] = useState<MentorshipSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const learnerName = learner?.displayName || 'Learner';
  const mentorName = mentor?.displayName || 'Mentor';
  const pairingLabel = `${mentorName} & ${learnerName}`;

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const rows = await listMentorshipSessions(relationship.id);
      setSessions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions');
    } finally {
      setLoading(false);
    }
  }, [relationship.id]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const now = useMemo(() => new Date().toISOString(), [sessions, loading]);

  const upcoming = useMemo(
    () =>
      sessions
        .filter((session) => isUpcomingSession(session, now))
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart)),
    [sessions, now],
  );

  const past = useMemo(
    () =>
      sessions
        .filter((session) => isPastSession(session, now))
        .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart)),
    [sessions, now],
  );

  async function onCancel(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await cancelMentorshipSession(sessionId);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the session');
    } finally {
      setBusyId(null);
    }
  }

  const upcomingColumns: TableColumn<MentorshipSession>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (session) => <Text variant="small">{formatSessionDate(session.scheduledStart)}</Text>,
    },
    {
      key: 'time',
      header: 'Time',
      render: (session) => <Text variant="small">{formatSessionTime(session.scheduledStart)}</Text>,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (session) => <Text variant="small">{formatDuration(session.durationMinutes)}</Text>,
    },
    {
      key: 'title',
      header: 'Session title',
      render: (session) => <Text variant="small">{session.title}</Text>,
    },
    {
      key: 'pairing',
      header: 'Mentor / learner',
      render: () => <Text variant="small">{pairingLabel}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (session) => (
        <Badge tone={sessionStatusTone(session.status)}>
          {SESSION_STATUS_LABEL[session.status]}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (session) => {
        const joinable =
          session.status === SESSION_STATUS.scheduled &&
          canJoinSession(account, session, relationship, now);
        const cancellable = canCancelSession(account, session);

        return (
          <Cluster gap={8}>
            {joinable ? (
              <Button
                size="sm"
                to={`/dashboard/mentorships/${relationship.id}/sessions/${session.id}`}
              >
                Join
              </Button>
            ) : null}
            {cancellable ? (
              <Button
                size="sm"
                variant="secondary"
                loading={busyId === session.id}
                onClick={() => void onCancel(session.id)}
              >
                Cancel
              </Button>
            ) : null}
          </Cluster>
        );
      },
    },
  ];

  const pastColumns: TableColumn<MentorshipSession>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (session) => <Text variant="small">{formatSessionDate(session.scheduledStart)}</Text>,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (session) => <Text variant="small">{formatDuration(session.durationMinutes)}</Text>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (session) => (
        <Badge tone={sessionStatusTone(session.status)}>
          {SESSION_STATUS_LABEL[session.status]}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap={16}>
      <Cluster gap={12}>
        <Text variant="h2">Sessions</Text>
        {canScheduleSession(account, relationship) ? (
          <Button size="sm" onClick={() => setScheduleOpen(true)}>
            Schedule a session
          </Button>
        ) : null}
      </Cluster>

      <Card padding="lg">
        <Stack gap={16}>
          <Stack gap={12}>
            <Text variant="h3">Upcoming sessions</Text>
            {loading ? (
              <Text variant="muted">Loading sessions…</Text>
            ) : upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming sessions"
                description="Schedule a video session when you are ready to meet."
              />
            ) : (
              <Table columns={upcomingColumns} rows={upcoming} rowKey={(row) => row.id} />
            )}
          </Stack>

          <Stack gap={12}>
            <Text variant="h3">Past sessions</Text>
            {loading ? (
              <Text variant="muted">Loading sessions…</Text>
            ) : past.length === 0 ? (
              <EmptyState title="No past sessions" description="Completed and cancelled sessions appear here." />
            ) : (
              <Table columns={pastColumns} rows={past} rowKey={(row) => row.id} />
            )}
          </Stack>

          {error ? <Text variant="danger">{error}</Text> : null}
        </Stack>
      </Card>

      <ScheduleSessionModal
        open={scheduleOpen}
        relationshipId={relationship.id}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => void loadSessions()}
      />
    </Stack>
  );
}
