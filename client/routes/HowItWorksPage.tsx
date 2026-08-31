import { Button, Cluster, Page, Stack } from '../components';
import { HowItWorks } from '../components/HowItWorks';
import { useAuth } from '../lib/auth';

export function HowItWorksPage() {
  const { account } = useAuth();

  return (
    <Page>
      <Stack gap={48}>
        <HowItWorks featured />
        <Cluster gap={12}>
          {account ? (
            <Button to="/mentors">Browse mentors</Button>
          ) : (
            <>
              <Button to="/signup">Sign up</Button>
              <Button variant="secondary" to="/mentors">
                Browse mentors
              </Button>
            </>
          )}
        </Cluster>
      </Stack>
    </Page>
  );
}
