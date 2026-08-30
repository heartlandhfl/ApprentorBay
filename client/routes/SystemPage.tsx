import { useEffect, useState } from 'react';
import type { HealthStatus } from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  Input,
  Page,
  Stack,
  Text,
} from '../components';
import { getHealth } from '../lib/api';
import { getFirebaseStatus } from '../lib/firebase';

export function SystemPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const firebase = getFirebaseStatus();

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((data) => {
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Health check failed');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Button variant="ghost" size="sm" to="/">
            Back to harbor
          </Button>
          <Text variant="h1">System health</Text>
          <Text variant="muted">
            The Express API, Vite client, and Firebase SDK must all come up
            cleanly before features land.
          </Text>
        </Stack>

        {error ? (
          <EmptyState
            title="The API did not answer"
            description={error}
            action={
              <Button variant="secondary" to="/">
                Return home
              </Button>
            }
          />
        ) : (
          <Card>
            <Stack gap={16}>
              <Cluster gap={12}>
                <Text variant="h3">API</Text>
                <Badge tone={health?.ok ? 'success' : loading ? 'neutral' : 'danger'}>
                  {loading ? 'Checking' : health?.ok ? 'Reachable' : 'Down'}
                </Badge>
              </Cluster>
              <Text variant="small">
                {health
                  ? `${health.service} · ${health.timestamp}`
                  : 'Waiting on GET /api/health'}
              </Text>
              <Text variant="small">
                Firebase Admin:{' '}
                {health
                  ? health.firebase.adminInitialized
                    ? 'initialized'
                    : health.firebase.adminConfigured
                      ? 'configured'
                      : 'waiting on credentials'
                  : '—'}
              </Text>
            </Stack>
          </Card>
        )}

        <Card>
          <Stack gap={16}>
            <Cluster gap={12}>
              <Text variant="h3">Firebase client</Text>
              <Badge tone={firebase.initialized ? 'success' : 'danger'}>
                {firebase.initialized ? 'Initialized' : 'Not initialized'}
              </Badge>
            </Cluster>
            <Text variant="small">
              Project: {firebase.projectId ?? 'missing VITE_FIREBASE_PROJECT_ID'}
            </Text>
            {firebase.error ? (
              <Text variant="danger">{firebase.error}</Text>
            ) : (
              <Text variant="small">
                Auth and Firestore are ready to use once real project credentials
                replace the placeholders in .env.
              </Text>
            )}
            <Input
              label="Project id"
              value={firebase.projectId ?? ''}
              readOnly
              hint="Read from VITE_FIREBASE_PROJECT_ID. Not a form."
            />
          </Stack>
        </Card>
      </Stack>
    </Page>
  );
}
