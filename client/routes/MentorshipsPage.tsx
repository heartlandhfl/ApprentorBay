import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  RELATIONSHIP_STATUS,
  RELATIONSHIP_STATUS_LABEL,
  USER_ROLE,
  isOpenRelationship,
  otherPartyId,
  type MentorshipRelationship,
} from '@apprentorbay/shared';
import { Badge, Button, EmptyState, Page, Stack, Table, Text } from '../components';
import { watchAccountRelationships } from '../features/mentorship';
import { getPublicDisplayName } from '../features/profiles';
import { useAuth } from '../lib/auth';

export function MentorshipsPage() {
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
    return watchAccountRelationships(
      account,
      (next) => {
        setRows(next);
        next.forEach((row) => {
          const otherId = otherPartyId(row, account.uid);
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

  const title =
    account?.role === USER_ROLE.mentor ? 'My Learners' : 'My Mentors';
  const current = (rows ?? []).filter((row) => isOpenRelationship(row));
  const closed = (rows ?? []).filter((row) => !isOpenRelationship(row));

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="h1">{title}</Text>
          <Text variant="muted">
            Active mentorships are dedicated relationships — not just an accepted
            application. Only the two of you can open the workspace.
          </Text>
        </Stack>

        {notice ? <Text variant="danger">{notice}</Text> : null}
        {error ? <Text variant="danger">{error}</Text> : null}

        {rows === null ? (
          <Text variant="muted">Loading mentorships…</Text>
        ) : (
          <Stack gap={32}>
            <RelationshipTable
              heading="Active mentorships"
              empty="No active mentorships yet"
              rows={current}
              accountUid={account?.uid}
              names={names}
            />
            {closed.length > 0 ? (
              <RelationshipTable
                heading="Ended"
                empty="No ended mentorships"
                rows={closed}
                accountUid={account?.uid}
                names={names}
              />
            ) : null}
          </Stack>
        )}
      </Stack>
    </Page>
  );
}

function RelationshipTable({
  heading,
  empty,
  rows,
  accountUid,
  names,
}: {
  heading: string;
  empty: string;
  rows: MentorshipRelationship[];
  accountUid?: string;
  names: Record<string, string>;
}) {
  return (
    <Stack gap={16}>
      <Text variant="h2">{heading}</Text>
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <Table
          rows={rows}
          rowKey={(row) => row.id}
          columns={[
            {
              key: 'with',
              header: 'With',
              render: (row) => {
                const otherId = accountUid ? otherPartyId(row, accountUid) : row.mentorId;
                return <Text>{names[otherId] ?? 'Member'}</Text>;
              },
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <Badge
                  tone={
                    row.status === RELATIONSHIP_STATUS.active
                      ? 'success'
                      : row.status === RELATIONSHIP_STATUS.paused
                        ? 'accent'
                        : 'neutral'
                  }
                >
                  {RELATIONSHIP_STATUS_LABEL[row.status]}
                </Badge>
              ),
            },
            {
              key: 'open',
              header: 'Workspace',
              render: (row) => (
                <Button size="sm" to={`/dashboard/mentorships/${row.id}`}>
                  Open workspace
                </Button>
              ),
            },
          ]}
        />
      )}
    </Stack>
  );
}
