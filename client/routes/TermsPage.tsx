import { TERMS_SECTIONS, TERMS_TITLE, termsEffectiveLabel } from '@apprentorbay/shared';
import { Button, Page, Stack, Text } from '../components';
import { useAuth } from '../lib/auth';

export function TermsPage() {
  const { account } = useAuth();

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="caption">Legal</Text>
          <Text variant="h1">{TERMS_TITLE}</Text>
          <Text variant="small">{termsEffectiveLabel()}</Text>
        </Stack>
        {TERMS_SECTIONS.map((section) => (
          <Stack key={section.heading} gap={8}>
            <Text variant="h2">{section.heading}</Text>
            <Text>{section.body}</Text>
          </Stack>
        ))}
        {account ? (
          <Button variant="secondary" to="/dashboard">
            Back to dashboard
          </Button>
        ) : (
          <Button variant="secondary" to="/signup">
            Back to sign up
          </Button>
        )}
      </Stack>
    </Page>
  );
}
