import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MentorshipApplication } from '@apprentorbay/shared';
import {
  normalizeApplicationCommercialFields,
  requestTypePublicLabel,
} from '@apprentorbay/shared';
import {
  Button,
  Cluster,
  EmptyState,
  Page,
  Stack,
  Table,
  Text,
} from '../components';
import { acceptApplication, declineApplication, watchPendingApplications } from '../features/mentorship';
import { getPublicDisplayName } from '../features/profiles';
import { useAuth } from '../lib/auth';

export function ApplicationsPage() {
  const { account } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<MentorshipApplication[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestedNames = useRef(new Set<string>());

  useEffect(() => {
    if (!account) return;
    return watchPendingApplications(
      account.uid,
      (next) => {
        setRows(next);
        next.forEach((row) => {
          if (requestedNames.current.has(row.learnerId)) return;
          requestedNames.current.add(row.learnerId);
          void getPublicDisplayName(row.learnerId).then((name) => {
            setNames((current) => ({ ...current, [row.learnerId]: name }));
          });
        });
      },
      (err) => setError(err.message),
    );
  }, [account]);

  async function accept(row: MentorshipApplication) {
    setBusyId(row.id);
    setError(null);
    try {
      const relationshipId = await acceptApplication(row);
      navigate(`/dashboard/mentorships/${relationshipId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept');
    } finally {
      setBusyId(null);
    }
  }

  async function decline(row: MentorshipApplication) {
    setBusyId(row.id);
    setError(null);
    try {
      await declineApplication(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Button variant="ghost" size="sm" to="/dashboard">
            Back to dashboard
          </Button>
          <Text variant="h1">Applications</Text>
          <Text variant="muted">
            Accepting opens a private conversation. Only the two of you can read it.
          </Text>
        </Stack>

        {error ? <Text variant="danger">{error}</Text> : null}

        {rows === null ? (
          <Text variant="muted">Loading applications…</Text>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No pending applications"
            description="When a learner applies, they appear here. Until then, keep your mentoring profile easy to find."
            action={
              <Button variant="secondary" to="/mentors/me">
                Prepare your mentoring profile
              </Button>
            }
          />
        ) : (
          <Table
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              {
                key: 'learner',
                header: 'Learner',
                render: (row) => <Text>{row.learnerDisplayName || names[row.learnerId] || 'Learner'}</Text>,
              },
              {
                key: 'requestType',
                header: 'Request',
                render: (row) => (
                  <Text variant="small">
                    {requestTypePublicLabel(normalizeApplicationCommercialFields(row).requestType)}
                  </Text>
                ),
              },
              {
                key: 'message',
                header: 'Message',
                render: (row) => <Text variant="small">{row.message}</Text>,
              },
              {
                key: 'actions',
                header: 'Decide',
                render: (row) => (
                  <Cluster gap={8}>
                    <Button
                      size="sm"
                      loading={busyId === row.id}
                      onClick={() => void accept(row)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === row.id}
                      onClick={() => void decline(row)}
                    >
                      Decline
                    </Button>
                    {row.learnerSlug ? (
                      <Button size="sm" variant="ghost" to={`/learners/${row.learnerSlug}`}>
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
    </Page>
  );
}
