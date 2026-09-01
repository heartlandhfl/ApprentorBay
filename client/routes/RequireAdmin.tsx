import type { ReactNode } from 'react';
import { USER_ROLE } from '@apprentorbay/shared';
import { Button, Cluster, EmptyState, Page, Text } from '../components';
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

  if (!account) {
    return (
      <Page>
        <EmptyState
          title="Sign in to administer"
          description="Sign in with the operator email listed in Firestore admins/. Signup cannot create an admin."
          action={
            <Cluster gap={12}>
              <Button to="/login">Log in</Button>
              <Button variant="secondary" to="/">
                Back home
              </Button>
            </Cluster>
          }
        />
      </Page>
    );
  }

  if (account.role !== USER_ROLE.admin) {
    return (
      <Page>
        <EmptyState
          title="Admins only"
          description="This account is a learner or mentor. Role cannot be changed from the app. The first admin is created from SEED_ADMIN_EMAIL on the server."
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
