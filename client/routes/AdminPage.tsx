import { useEffect, useState, type ReactNode } from 'react';
import type {
  AccountRow,
  AccountStatus,
  AdminAuditLog,
  AdminCounts,
  PendingMentorRow,
  SupportIssue,
  User,
  VerificationStatus,
} from '@apprentorbay/shared';
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABEL,
  APPROVAL_DISCLAIMER,
  APPROVAL_STATUS_LABEL,
  SUPPORT_ISSUE_STATUS,
  USER_ROLE,
  VERIFICATION_CASE_STATUS_LABEL,
  VERIFICATION_STATUS,
  accountStatusOf,
  isAccountActive,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Grid,
  Modal,
  Page,
  Stack,
  Table,
  Text,
  TextArea,
} from '../components';
import {
  listAccounts,
  listAdminAudit,
  listAdminCounts,
  listPendingMentors,
  listPendingVerification,
  listSupportIssues,
  resolveSupportIssue,
  setAccountStatus,
  setMentorVerified,
  setMentorVerification,
  setVerificationCase,
} from '../lib/api';

type ReasonAction = {
  title: string;
  confirm: string;
  required: boolean;
  run: (reason: string) => Promise<unknown>;
};

export function AdminPage() {
  const [counts, setCounts] = useState<AdminCounts | null>(null);
  const [pending, setPending] = useState<PendingMentorRow[] | null>(null);
  const [verification, setVerification] = useState<PendingMentorRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [issues, setIssues] = useState<SupportIssue[] | null>(null);
  const [audit, setAudit] = useState<AdminAuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState('');

  async function refresh() {
    try {
      const [nextCounts, nextPending, nextVerification, nextAccounts, nextIssues, nextAudit] =
        await Promise.all([
          listAdminCounts(),
          listPendingMentors(),
          listPendingVerification(),
          listAccounts(),
          listSupportIssues(),
          listAdminAudit(),
        ]);
      setCounts(nextCounts);
      setPending(nextPending);
      setVerification(nextVerification);
      setAccounts(nextAccounts);
      setIssues(nextIssues);
      setAudit(nextAudit);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function ask(action: ReasonAction) {
    setReason('');
    setReasonAction(action);
  }

  async function runReason() {
    if (!reasonAction) return;
    setBusyId(reasonAction.title);
    try {
      await reasonAction.run(reason);
      setReasonAction(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete the admin action');
    } finally {
      setBusyId(null);
    }
  }

  const learners = (accounts ?? []).filter((row) => row.user.role === USER_ROLE.learner);
  const mentors = (accounts ?? []).filter((row) => row.user.role === USER_ROLE.mentor);
  const openIssues = (issues ?? []).filter((row) => row.status !== SUPPORT_ISSUE_STATUS.resolved);

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="h1">Administration</Text>
          <Text variant="muted">
            Platform governance. Approval is participation. Verification is a separate
            evidence check. {APPROVAL_DISCLAIMER} Email stays on this page.
          </Text>
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        {counts ? (
          <Grid cols={3}>
            <StatCard label="Total users" value={counts.totalUsers} />
            <StatCard label="Learners" value={counts.learners} />
            <StatCard label="Mentors" value={counts.mentors} />
            <StatCard label="Pending mentor approvals" value={counts.pendingMentorApprovals} />
            <StatCard label="Pending verification" value={counts.pendingVerification} />
            <StatCard label="Active mentorship relationships" value={counts.activeRelationships} />
            <StatCard label="Active learning contracts" value={counts.activeLearningContracts} />
            <StatCard label="Completed deliverables" value={counts.completedDeliverables} />
            <StatCard label="Support issues" value={counts.supportIssues} />
          </Grid>
        ) : (
          <Text variant="muted">Loading counts…</Text>
        )}

        <QueueTable
          title="Pending mentor approvals"
          empty="No mentors waiting on approval"
          rows={pending}
          actions={(row) => (
            <Cluster gap={8}>
              <Button
                size="sm"
                onClick={() =>
                  ask({
                    title: `Approve ${row.user.displayName}`,
                    confirm: 'Approve',
                    required: false,
                    run: (nextReason) =>
                      setMentorVerification(row.user.uid, VERIFICATION_STATUS.approved, nextReason),
                  })
                }
              >
                Approve mentor
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  ask({
                    title: `Reject ${row.user.displayName}`,
                    confirm: 'Reject',
                    required: true,
                    run: (nextReason) =>
                      setMentorVerification(row.user.uid, VERIFICATION_STATUS.rejected, nextReason),
                  })
                }
              >
                Reject mentor
              </Button>
              {profileLink(row.user, row.profile.slug)}
            </Cluster>
          )}
        />

        <QueueTable
          title="Pending verification"
          empty="No verification cases waiting"
          rows={verification}
          extra={(row) => (
            <Text variant="small">
              {VERIFICATION_CASE_STATUS_LABEL[row.profile.verificationCaseStatus]}
            </Text>
          )}
          actions={(row) => (
            <Cluster gap={8}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void setVerificationCase(row.user.uid, 'under_review').then(refresh)}
              >
                Under review
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  ask({
                    title: `Verify ${row.user.displayName}`,
                    confirm: 'Verify mentor',
                    required: false,
                    run: (nextReason) => setMentorVerified(row.user.uid, true, nextReason),
                  })
                }
              >
                Verify mentor
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  ask({
                    title: `Remove verification for ${row.user.displayName}`,
                    confirm: 'Remove verification',
                    required: true,
                    run: (nextReason) => setMentorVerified(row.user.uid, false, nextReason),
                  })
                }
              >
                Remove verification
              </Button>
              {profileLink(row.user, row.profile.slug)}
            </Cluster>
          )}
        />

        <Stack gap={16}>
          <Text variant="h2">Support issues</Text>
          {issues === null ? (
            <Text variant="muted">Loading support issues…</Text>
          ) : openIssues.length === 0 ? (
            <EmptyState title="No open support issues" />
          ) : (
            <Table
              rows={openIssues}
              rowKey={(row) => row.id}
              columns={[
                { key: 'subject', header: 'Subject', render: (row) => <Text>{row.subject}</Text> },
                { key: 'who', header: 'Reporter', render: (row) => <Text variant="small">{row.reporterName}</Text> },
                { key: 'body', header: 'Details', render: (row) => <Text variant="small">{row.body}</Text> },
                {
                  key: 'actions',
                  header: 'Action',
                  render: (row) => (
                    <Button
                      size="sm"
                      onClick={() =>
                        ask({
                          title: `Resolve “${row.subject}”`,
                          confirm: 'Resolve',
                          required: false,
                          run: (nextReason) => resolveSupportIssue(row.id, nextReason).then(() => undefined),
                        })
                      }
                    >
                      Resolve
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Stack>

        <AccountTable
          title="Mentor accounts"
          rows={mentors}
          onStatus={(user, status) =>
            ask({
              title: `${accountActionLabel(status)} ${user.displayName}`,
              confirm: accountActionLabel(status),
              required: status !== ACCOUNT_STATUS.active,
              run: (nextReason) => setAccountStatus(user.uid, status, nextReason).then(() => undefined),
            })
          }
          onApproval={(user, status) =>
            ask({
              title: `${approvalActionLabel(status)} ${user.displayName}`,
              confirm: approvalActionLabel(status),
              required: status !== VERIFICATION_STATUS.approved,
              run: (nextReason) => setMentorVerification(user.uid, status, nextReason),
            })
          }
          onVerify={(user, verified) =>
            ask({
              title: verified ? `Verify ${user.displayName}` : `Remove verification for ${user.displayName}`,
              confirm: verified ? 'Verify mentor' : 'Remove verification',
              required: !verified,
              run: (nextReason) => setMentorVerified(user.uid, verified, nextReason),
            })
          }
        />

        <AccountTable
          title="Learner accounts"
          rows={learners}
          onStatus={(user, status) =>
            ask({
              title: `${accountActionLabel(status)} ${user.displayName}`,
              confirm: accountActionLabel(status),
              required: status !== ACCOUNT_STATUS.active,
              run: (nextReason) => setAccountStatus(user.uid, status, nextReason).then(() => undefined),
            })
          }
        />

        <Stack gap={16}>
          <Text variant="h2">Audit log</Text>
          {audit === null ? (
            <Text variant="muted">Loading audit log…</Text>
          ) : audit.length === 0 ? (
            <EmptyState title="No administrative actions yet" />
          ) : (
            <Table
              rows={audit}
              rowKey={(row) => row.id}
              columns={[
                { key: 'time', header: 'Timestamp', render: (row) => <Text variant="small">{new Date(row.timestamp || row.createdAt).toLocaleString()}</Text> },
                { key: 'action', header: 'Action', render: (row) => <Text variant="small">{row.action}</Text> },
                { key: 'admin', header: 'Admin', render: (row) => <Text variant="small">{row.adminId || row.actorId}</Text> },
                { key: 'target', header: 'Target', render: (row) => <Text variant="small">{row.targetUserId || '—'}</Text> },
                { key: 'reason', header: 'Reason', render: (row) => <Text variant="small">{row.reason || '—'}</Text> },
              ]}
            />
          )}
        </Stack>
      </Stack>

      <Modal
        open={Boolean(reasonAction)}
        title={reasonAction?.title ?? ''}
        onClose={() => setReasonAction(null)}
        footer={
          <Cluster gap={8}>
            <Button variant="secondary" onClick={() => setReasonAction(null)}>
              Cancel
            </Button>
            <Button loading={Boolean(busyId)} onClick={() => void runReason()}>
              {reasonAction?.confirm ?? 'Confirm'}
            </Button>
          </Cluster>
        }
      >
        <TextArea
          label={reasonAction?.required ? 'Reason (required)' : 'Reason (optional)'}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required={reasonAction?.required}
        />
      </Modal>
    </Page>
  );
}

function QueueTable({
  title,
  empty,
  rows,
  extra,
  actions,
}: {
  title: string;
  empty: string;
  rows: PendingMentorRow[] | null;
  extra?: (row: PendingMentorRow) => ReactNode;
  actions: (row: PendingMentorRow) => ReactNode;
}) {
  return (
    <Stack gap={16}>
      <Text variant="h2">{title}</Text>
      {rows === null ? (
        <Text variant="muted">Loading…</Text>
      ) : rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <Table
          rows={rows}
          rowKey={(row) => row.user.uid}
          columns={[
            { key: 'name', header: 'Mentor', render: (row) => <Text>{row.user.displayName}</Text> },
            { key: 'email', header: 'Email', render: (row) => <Text variant="small">{row.user.email}</Text> },
            ...(extra
              ? [{ key: 'extra', header: 'Case', render: extra }]
              : []),
            { key: 'actions', header: 'Decide', render: actions },
          ]}
        />
      )}
    </Stack>
  );
}

function AccountTable({
  title,
  rows,
  onStatus,
  onApproval,
  onVerify,
}: {
  title: string;
  rows: AccountRow[];
  onStatus: (user: User, status: AccountStatus) => void;
  onApproval?: (user: User, status: Exclude<VerificationStatus, 'pending'>) => void;
  onVerify?: (user: User, verified: boolean) => void;
}) {
  return (
    <Stack gap={16}>
      <Text variant="h2">{title}</Text>
      {rows.length === 0 ? (
        <EmptyState title="No accounts in this group" />
      ) : (
        <Table
          rows={rows}
          rowKey={(row) => row.user.uid}
          columns={[
            { key: 'name', header: 'Name', render: (row) => <Text>{row.user.displayName}</Text> },
            { key: 'email', header: 'Email', render: (row) => <Text variant="small">{row.user.email}</Text> },
            {
              key: 'status',
              header: 'Account',
              render: (row) => <StatusBadge status={accountStatusOf(row.user)} />,
            },
            ...(onApproval
              ? [
                  {
                    key: 'approval',
                    header: 'Approval',
                    render: (row: AccountRow) => (
                      <Text variant="small">
                        {APPROVAL_STATUS_LABEL[row.approvalStatus ?? VERIFICATION_STATUS.pending]}
                      </Text>
                    ),
                  },
                  {
                    key: 'verify',
                    header: 'Verification',
                    render: (row: AccountRow) => (
                      <Text variant="small">
                        {row.verificationCaseStatus
                          ? VERIFICATION_CASE_STATUS_LABEL[row.verificationCaseStatus]
                          : 'Not submitted'}
                      </Text>
                    ),
                  },
                ]
              : []),
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <Cluster gap={8}>
                  {profileLink(row.user, row.publicSlug)}
                  {onApproval && row.approvalStatus !== VERIFICATION_STATUS.approved ? (
                    <Button size="sm" onClick={() => onApproval(row.user, VERIFICATION_STATUS.approved)}>
                      Approve
                    </Button>
                  ) : null}
                  {onApproval && row.approvalStatus !== VERIFICATION_STATUS.rejected ? (
                    <Button size="sm" variant="secondary" onClick={() => onApproval(row.user, VERIFICATION_STATUS.rejected)}>
                      Reject
                    </Button>
                  ) : null}
                  {onApproval && row.approvalStatus === VERIFICATION_STATUS.approved ? (
                    <Button size="sm" variant="secondary" onClick={() => onApproval(row.user, VERIFICATION_STATUS.suspended)}>
                      Suspend mentor
                    </Button>
                  ) : null}
                  {onVerify ? (
                    <Button size="sm" variant="secondary" onClick={() => onVerify(row.user, true)}>
                      Verify
                    </Button>
                  ) : null}
                  {onVerify && row.verificationCaseStatus && row.verificationCaseStatus !== 'not_submitted' ? (
                    <Button size="sm" variant="ghost" onClick={() => onVerify(row.user, false)}>
                      Remove verification
                    </Button>
                  ) : null}
                  {isAccountActive(row.user) ? (
                    <>
                      {accountStatusOf(row.user) !== ACCOUNT_STATUS.restricted ? (
                        <Button size="sm" variant="secondary" onClick={() => onStatus(row.user, ACCOUNT_STATUS.restricted)}>
                          Restrict
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => onStatus(row.user, ACCOUNT_STATUS.active)}>
                          Restore
                        </Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => onStatus(row.user, ACCOUNT_STATUS.suspended)}>
                        Suspend
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onStatus(row.user, ACCOUNT_STATUS.terminated)}>
                        Terminate
                      </Button>
                    </>
                  ) : accountStatusOf(row.user) === ACCOUNT_STATUS.terminated ? (
                    <Text variant="small">Terminated</Text>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => onStatus(row.user, ACCOUNT_STATUS.active)}>
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
  );
}

function accountActionLabel(status: AccountStatus): string {
  switch (status) {
    case ACCOUNT_STATUS.active:
      return 'Restore';
    case ACCOUNT_STATUS.restricted:
      return 'Restrict';
    case ACCOUNT_STATUS.suspended:
      return 'Suspend';
    case ACCOUNT_STATUS.terminated:
      return 'Terminate';
    default:
      return ACCOUNT_STATUS_LABEL[status];
  }
}

function approvalActionLabel(status: Exclude<VerificationStatus, 'pending'>): string {
  switch (status) {
    case VERIFICATION_STATUS.approved:
      return 'Approve';
    case VERIFICATION_STATUS.rejected:
      return 'Reject';
    case VERIFICATION_STATUS.suspended:
      return 'Suspend mentor';
    default:
      return APPROVAL_STATUS_LABEL[status];
  }
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const tone =
    status === ACCOUNT_STATUS.active
      ? 'success'
      : status === ACCOUNT_STATUS.restricted
        ? 'accent'
        : 'danger';
  return <Badge tone={tone}>{ACCOUNT_STATUS_LABEL[status]}</Badge>;
}

function profileLink(user: User, slug?: string | null) {
  if (!slug) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      to={user.role === USER_ROLE.mentor ? `/mentors/${slug}` : `/learners/${slug}`}
    >
      View profile
    </Button>
  );
}

function StatCard({ label, value }: { label: number | string; value: number } | { label: string; value: number }) {
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
