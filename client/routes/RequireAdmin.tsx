import type { ReactNode } from 'react';
import { USER_ROLE } from '@apprentorbay/shared';
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

  if (!account || account.role !== USER_ROLE.admin) {
    return (
      <Page>
        <EmptyState
          title="Admins only"
          description="This page is locked. Your account role is checked here and again on the server."
          action={
            <Button variant="secondary" to="/">
              Back home
            </Button>
          }
        />
      </Page>
    );
  }

  return children;
}
