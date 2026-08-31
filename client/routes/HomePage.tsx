import {
  Badge,
  Button,
  Card,
  Cluster,
  Page,
  Stack,
  Text,
} from '../components';
import { HowItWorks } from '../components/HowItWorks';
import { useAuth } from '../lib/auth';

export function HomePage() {
  const { account } = useAuth();

  return (
    <Page>
      <Stack gap={48}>
        <Stack gap={16}>
          <Badge tone="accent">Mentorship and apprenticeship</Badge>
          <Text variant="display">
            Rise on the Shoulders of Giants: Learn from experienced mentors, build real
            skills, and prove what you can do, guided by people who have walked the path
            before you.
          </Text>
          <Text variant="muted">
            ApprentorBay is not a feed. It is a pairing, a living contract, and a
            deliverable both people can point to.
          </Text>
          <Cluster gap={12}>
            {account ? (
              <>
                <Button to="/mentors">Browse mentors</Button>
                <Button variant="secondary" to={account.role === 'admin' ? '/admin' : '/dashboard/messages'}>
                  {account.role === 'admin' ? 'Open admin' : 'Go to messages'}
                </Button>
              </>
            ) : (
              <>
                <Button to="/signup">Sign up</Button>
                <Button variant="secondary" to="/login">
                  Log in
                </Button>
                <Button variant="ghost" to="/mentors">
                  Browse mentors
                </Button>
              </>
            )}
          </Cluster>
        </Stack>

        <HowItWorks />

        <Card padding="lg">
          <Stack gap={16}>
            <Text variant="h2">Meet the people who have walked it</Text>
            <Text variant="muted">
              Only verified mentors appear here. Pending and suspended accounts stay
              off the public directory.
            </Text>
            <Cluster gap={12}>
              <Button to="/mentors">Open the mentors directory</Button>
              {account ? null : (
                <Button variant="secondary" to="/signup">
                  Create an account
                </Button>
              )}
            </Cluster>
          </Stack>
        </Card>
      </Stack>
    </Page>
  );
}
