import {
  SESSION_STATUS,
  SESSION_STATUS_LABEL,
  type MentorshipRelationship,
  type MentorshipSession,
  type User,
} from '@apprentorbay/shared';
import { Badge, Button, Cluster, Stack, Text } from '../../components';
import {
  formatDuration,
  formatSessionDate,
  formatSessionDateTime,
  formatSessionTime,
  sessionStatusTone,
} from './format';

type UpcomingSessionCardProps = {
  session: MentorshipSession;
  relationship: MentorshipRelationship;
  account: User;
  pairingLabel: string;
  joinable: boolean;
  cancellable: boolean;
  busy: boolean;
  onCancel: () => void;
};

export function UpcomingSessionCard({
  session,
  relationship,
  pairingLabel,
  joinable,
  cancellable,
  busy,
  onCancel,
}: UpcomingSessionCardProps) {
  return (
    <div className="rounded-sm border border-line bg-paper p-4">
      <Stack gap={12}>
        <Cluster gap={8}>
          <Text variant="h3">{session.title}</Text>
          <Badge tone={sessionStatusTone(session.status)}>
            {SESSION_STATUS_LABEL[session.status]}
          </Badge>
        </Cluster>
        <Stack gap={4}>
          <Text variant="small">{formatSessionDate(session.scheduledStart)}</Text>
          <Text variant="small">{formatSessionTime(session.scheduledStart)}</Text>
          <Text variant="small">{formatDuration(session.durationMinutes)}</Text>
          <Text variant="caption">{pairingLabel}</Text>
        </Stack>
        <Cluster gap={8}>
          {joinable ? (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              to={`/dashboard/mentorships/${relationship.id}/sessions/${session.id}`}
            >
              Join session
            </Button>
          ) : null}
          {cancellable ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              loading={busy}
              onClick={onCancel}
            >
              Cancel session
            </Button>
          ) : null}
        </Cluster>
      </Stack>
    </div>
  );
}

type PastSessionCardProps = {
  session: MentorshipSession;
};

export function PastSessionCard({ session }: PastSessionCardProps) {
  return (
    <div className="rounded-sm border border-line bg-paper p-4">
      <Stack gap={8}>
        <Cluster gap={8}>
          <Text variant="small">{formatSessionDateTime(session.scheduledStart)}</Text>
          <Badge tone={sessionStatusTone(session.status)}>
            {SESSION_STATUS_LABEL[session.status]}
          </Badge>
        </Cluster>
        <Text variant="small">{formatDuration(session.durationMinutes)}</Text>
        {session.status === SESSION_STATUS.scheduled ? (
          <Text variant="caption">Ended without completion</Text>
        ) : null}
      </Stack>
    </div>
  );
}
