import type { ReactNode } from 'react';
import { isAccountActive, type UserRole } from '@apprentorbay/shared';
import { Button, EmptyState, Page, Text } from '../components';
import { useAuth } from '../lib/auth';

type RequireAuthProps = {
  children: ReactNode;
  role?: UserRole;
};

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { account, loading } = useAuth();

  if (loading) {
    return (
      <Page>
        <Text variant="muted">Checking your account…</Text>
      </Page>
    );
  }

  if (!account || !isAccountActive(account)) {
    return (
      <Page>
        <EmptyState
          title="Sign in to continue"
          description="This page is for people who already have an ApprentorBay account."
          action={
            <Button to="/login">Log in</Button>
          }
        />
      </Page>
    );
  }

  if (role && account.role !== role) {
    return (
      <Page>
        <EmptyState
          title="Wrong role"
          description={`This page is for ${role}s.`}
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
