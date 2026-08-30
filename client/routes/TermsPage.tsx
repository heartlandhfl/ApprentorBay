import { TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from '@apprentorbay/shared';
import { Button, Page, Stack, Text } from '../components';

export function TermsPage() {
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
        <Button variant="secondary" to="/">
          Back to harbor
        </Button>
      </Stack>
    </Page>
  );
}
