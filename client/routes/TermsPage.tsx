import { Navigate } from 'react-router-dom';
import { TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION, needsTermsAcceptance } from '@apprentorbay/shared';
import { Button, Page, Stack, Text } from '../components';
import { useAuth } from '../lib/auth';

export function TermsPage() {
  const { account, loading } = useAuth();

  if (loading) {
    return (
      <Page>
        <Text variant="muted">Loading…</Text>
      </Page>
    );
  }

  if (account && !needsTermsAcceptance(account)) {
    return <Navigate to="/" replace />;
  }

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="caption">Legal</Text>
          <Text variant="h1">{TERMS_TITLE}</Text>
          <Text variant="small">Version {TERMS_VERSION}</Text>
        </Stack>
        {TERMS_SECTIONS.map((section) => (
          <Stack key={section.heading} gap={8}>
            <Text variant="h2">{section.heading}</Text>
            <Text>{section.body}</Text>
          </Stack>
        ))}
        {account ? null : (
          <Button variant="secondary" to="/signup">
            Back to sign up
          </Button>
        )}
      </Stack>
    </Page>
  );
}
