import type { ReactNode } from 'react';
import { Button, EmptyState, Page, Text } from '../components';
import { useAuth } from '../lib/auth';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { account, loading } = useAuth();

  if (loading) {
    return (
      <Page>
        <Text variant="muted">Checking your role…</Text>
      </Page>
    );
  }

  if (!account || account.role !== 'admin') {
    return (
      <Page>
        <EmptyState
          title="Admins only"
          description="This desk is locked. Your account role is checked here and again on the server."
          action={
            <Button variant="secondary" to="/">
              Back to harbor
            </Button>
          }
        />
      </Page>
    );
  }

  return children;
}
