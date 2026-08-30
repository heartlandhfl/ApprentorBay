import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { MentorshipRelationship } from '@apprentorbay/shared';
import {
  Button,
  EmptyState,
  Page,
  Stack,
  Table,
  Text,
} from '../components';
import { watchActiveRelationships } from '../features/mentorship';
import { getPublicDisplayName } from '../features/profiles';
import { useAuth } from '../lib/auth';

export function MessagesInboxPage() {
  const { account } = useAuth();
  const location = useLocation();
  const notice =
    typeof location.state === 'object' &&
    location.state &&
    'notice' in location.state &&
    typeof location.state.notice === 'string'
      ? location.state.notice
      : null;
  const [rows, setRows] = useState<MentorshipRelationship[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const requestedNames = useRef(new Set<string>());

  useEffect(() => {
    if (!account) return;
    return watchActiveRelationships(
      account,
      (next) => {
        setRows(next);
        next.forEach((row) => {
          const otherId = row.learnerId === account.uid ? row.mentorId : row.learnerId;
          if (requestedNames.current.has(otherId)) return;
          requestedNames.current.add(otherId);
          void getPublicDisplayName(otherId).then((name) => {
            setNames((current) => ({ ...current, [otherId]: name }));
          });
        });
      },
      (err) => setError(err.message),
    );
  }, [account]);

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Text variant="h1">Messages</Text>
          <Text variant="muted">
            Only pairings you have accepted live here. No one else can open them.
          </Text>
        </Stack>

        {notice ? <Text variant="danger">{notice}</Text> : null}
        {error ? <Text variant="danger">{error}</Text> : null}

        {rows === null ? (
          <Text variant="muted">Loading conversations…</Text>
        ) : rows.length === 0 ? (
          <EmptyState title="No conversations yet" />
        ) : (
          <Table
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              {
                key: 'with',
                header: 'With',
                render: (row) => {
                  const otherId = account && row.learnerId === account.uid ? row.mentorId : row.learnerId;
                  return <Text>{names[otherId] ?? 'Member'}</Text>;
                },
              },
              {
                key: 'open',
                header: 'Open',
                render: (row) => (
                  <Button size="sm" to={`/dashboard/messages/${row.id}`}>
                    Open conversation
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Stack>
    </Page>
  );
}
