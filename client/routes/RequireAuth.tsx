import type { ReactNode } from 'react';
import type { UserRole } from '@apprentorbay/shared';
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

  if (!account) {
    return (
      <Page>
        <EmptyState
          title="Sign in to continue"
          description="This desk is for people who already have a harbor account."
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
          title="Wrong desk"
          description={`This page is for ${role}s.`}
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
