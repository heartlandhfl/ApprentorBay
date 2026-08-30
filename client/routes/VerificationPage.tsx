import { useEffect, useState } from 'react';
import type { PendingMentorRow } from '@apprentorbay/shared';
import {
  Button,
  Cluster,
  EmptyState,
  Page,
  Stack,
  Table,
  Text,
} from '../components';
import { listPendingMentors, setMentorVerification } from '../lib/api';

export function VerificationPage() {
  const [rows, setRows] = useState<PendingMentorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const next = await listPendingMentors();
      setRows(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pending mentors');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function decide(userId: string, status: 'approved' | 'rejected') {
    setBusyId(userId);
    try {
      await setMentorVerification(userId, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update verification');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Text variant="h1">Mentor verification</Text>
          <Text variant="muted">
            Approve or reject pending mentors. This writes through Express after
            the server confirms your role is admin.
          </Text>
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        {rows === null ? (
          <Text variant="muted">Loading pending mentors…</Text>
        ) : rows.length === 0 ? (
          <EmptyState title="No mentors waiting on approval" />
        ) : (
          <Table
            rows={rows}
            rowKey={(row) => row.user.uid}
            columns={[
              {
                key: 'name',
                header: 'Mentor',
                render: (row) => <Text>{row.user.displayName}</Text>,
              },
              {
                key: 'email',
                header: 'Email',
                render: (row) => <Text variant="small">{row.user.email}</Text>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <Text variant="small">{row.profile.verificationStatus}</Text>,
              },
              {
                key: 'actions',
                header: 'Decide',
                render: (row) => (
                  <Cluster gap={8}>
                    <Button
                      size="sm"
                      loading={busyId === row.user.uid}
                      onClick={() => void decide(row.user.uid, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === row.user.uid}
                      onClick={() => void decide(row.user.uid, 'rejected')}
                    >
                      Reject
                    </Button>
                    <Button size="sm" variant="ghost" to={`/mentors/${row.user.uid}`}>
                      View profile
                    </Button>
                  </Cluster>
                ),
              },
            ]}
          />
        )}
      </Stack>
    </Page>
  );
}
