import { useEffect, useState } from 'react';
import type { AccountRow, AdminCounts, PendingMentorRow, User, VerifiedClaimType } from '@apprentorbay/shared';
import {
  APPROVAL_DISCLAIMER,
  APPROVAL_STATUS_LABEL,
  USER_ROLE,
  VERIFICATION_STATUS,
  VERIFIED_CLAIM_LABEL,
  VERIFIED_CLAIM_TYPE,
  isAccountActive,
} from '@apprentorbay/shared';
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
  setMentorClaim,
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

  async function decide(
    userId: string,
    status: typeof VERIFICATION_STATUS.approved | typeof VERIFICATION_STATUS.rejected,
  ) {
    setBusyId(userId);
    try {
      await setMentorVerification(userId, status);
      await refresh();
    } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not update approval');
    } finally {
      setBusyId(null);
    }
  }

  async function setClaim(userId: string, type: VerifiedClaimType, verified: boolean) {
    setBusyId(`${userId}-${type}`);
    try {
      await setMentorClaim(userId, type, verified);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the verified claim');
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
            Counts, pending mentor approvals, verified claims, and account suspension.
            Approval is participation only. {APPROVAL_DISCLAIMER} Email stays on this
            page; it is not copied onto public profiles.
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
          <Text variant="h2">Pending mentor approvals</Text>
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
                        onClick={() => void decide(row.user.uid, VERIFICATION_STATUS.approved)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busyId === row.user.uid}
                        onClick={() => void decide(row.user.uid, VERIFICATION_STATUS.rejected)}
                      >
                        Reject
                      </Button>
                      {row.profile.slug ? (
                        <Button size="sm" variant="ghost" to={`/mentors/${row.profile.slug}`}>
                          View profile
                        </Button>
                      ) : null}
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
                  key: 'approval',
                  header: 'Approval / verified claims',
                  render: (row) =>
                    row.user.role === USER_ROLE.mentor ? (
                      <Stack gap={8}>
                        <Text variant="small">
                          {APPROVAL_STATUS_LABEL[row.approvalStatus ?? VERIFICATION_STATUS.pending]}
                        </Text>
                        <Cluster gap={8}>
                          {Object.values(VERIFIED_CLAIM_TYPE).map((type) => {
                            const current = row.verifiedClaims?.find((item) => item.type === type);
                            const on = current?.verified === true;
                            return (
                              <Button
                                key={type}
                                size="sm"
                                variant={on ? 'secondary' : 'ghost'}
                                loading={busyId === `${row.user.uid}-${type}`}
                                onClick={() => void setClaim(row.user.uid, type, !on)}
                              >
                                {on ? VERIFIED_CLAIM_LABEL[type] : `Verify ${type.replace('_', ' ')}`}
                              </Button>
                            );
                          })}
                        </Cluster>
                      </Stack>
                    ) : (
                      <Text variant="small">—</Text>
                    ),
                },
                {
                  key: 'actions',
                  header: 'Action',
                  render: (row) =>
                    row.user.role === USER_ROLE.admin ? (
                      <Text variant="small">Admin</Text>
                    ) : (
                      <Cluster gap={8}>
                        {row.publicSlug ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            to={
                              row.user.role === USER_ROLE.mentor
                                ? `/mentors/${row.publicSlug}`
                                : `/learners/${row.publicSlug}`
                            }
                          >
                            View profile
                          </Button>
                        ) : null}
                        {isAccountActive(row.user) ? (
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
                        )}
                      </Cluster>
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
