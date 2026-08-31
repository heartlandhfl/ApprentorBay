import { useEffect, useState } from 'react';
import type { AccountRow, AdminCounts, PendingMentorRow, User } from '@apprentorbay/shared';
import { isAccountActive } from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Grid,
  Page,
  Stack,
  Table,
  Text,
} from '../components';
import {
  listAccounts,
  listAdminCounts,
  listPendingMentors,
  setAccountActive,
  setMentorVerification,
} from '../lib/api';

export function AdminPage() {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [pending, setPending] = useState<PendingMentorRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const [nextCounts, nextPending, nextAccounts] = await Promise.all([
        listAdminCounts(),
        listPendingMentors(),
        listAccounts(),
      ]);
      setCounts(nextCounts);
      setPending(nextPending);
      setAccounts(nextAccounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin');
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

  async function setActive(user: User, active: boolean) {
    setBusyId(user.uid);
    try {
      await setAccountActive(user.uid, active);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the account');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="h1">Admin</Text>
          <Text variant="muted">
            Counts, pending mentor approvals, and account suspension. Suspension sets
            active to false, hides the public profile, and blocks login.
          </Text>
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        {counts ? (
          <Grid cols={3}>
            <StatCard label="Mentors" value={counts.mentors} />
            <StatCard label="Learners" value={counts.learners} />
            <StatCard label="Active relationships" value={counts.activeRelationships} />
            <StatCard label="Contracts in progress" value={counts.contractsInProgress} />
            <StatCard label="Completed deliverables" value={counts.completedDeliverables} />
          </Grid>
        ) : (
          <Text variant="muted">Loading counts…</Text>
        )}

        <Stack gap={16}>
          <Text variant="h2">Pending mentor verifications</Text>
          {pending === null ? (
            <Text variant="muted">Loading pending mentors…</Text>
          ) : pending.length === 0 ? (
            <EmptyState title="No mentors waiting on approval" />
          ) : (
            <Table
              rows={pending}
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

        <Stack gap={16}>
          <Text variant="h2">Accounts</Text>
          {accounts === null ? (
            <Text variant="muted">Loading accounts…</Text>
          ) : accounts.length === 0 ? (
            <EmptyState title="No accounts yet" />
          ) : (
            <Table
              rows={accounts}
              rowKey={(row) => row.user.uid}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (row) => <Text>{row.user.displayName}</Text>,
                },
                {
                  key: 'email',
                  header: 'Email',
                  render: (row) => <Text variant="small">{row.user.email}</Text>,
                },
                {
                  key: 'role',
                  header: 'Role',
                  render: (row) => <Text variant="small">{row.user.role}</Text>,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) =>
                    isAccountActive(row.user) ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="danger">Suspended</Badge>
                    ),
                },
                {
                  key: 'actions',
                  header: 'Action',
                  render: (row) =>
                    row.user.role === 'admin' ? (
                      <Text variant="small">Admin</Text>
                    ) : isAccountActive(row.user) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busyId === row.user.uid}
                        onClick={() => void setActive(row.user, false)}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === row.user.uid}
                        onClick={() => void setActive(row.user, true)}
                      >
                        Restore
                      </Button>
                    ),
                },
              ]}
            />
          )}
        </Stack>
      </Stack>
    </Page>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <Stack gap={8}>
        <Text variant="caption">{label}</Text>
        <Text variant="h1" as="p">
          {value}
        </Text>
      </Stack>
    </Card>
  );
}
