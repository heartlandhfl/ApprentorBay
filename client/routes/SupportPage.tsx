import { useState, type FormEvent } from 'react';
import { Button, Page, Stack, Text, TextArea, Input } from '../components';
import { useAuth } from '../lib/auth';
import { fileSupportIssue } from '../lib/api';

export function SupportPage() {
  const { account } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await fileSupportIssue(subject, body);
      setSubject('');
      setBody('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the issue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={8}>
          <Text variant="h1">Support</Text>
          <Text variant="muted">
            Tell the platform team about a problem. Admins see open issues on the
            administration dashboard.
          </Text>
        </Stack>
        {account ? (
          <form onSubmit={(event) => void onSubmit(event)}>
            <Stack gap={16}>
              <Input
                label="Subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
              <TextArea
                label="What happened"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
              />
              {error ? <Text variant="danger">{error}</Text> : null}
              {saved ? <Text variant="small">Sent. An admin will see this on the dashboard.</Text> : null}
              <Button type="submit" loading={busy}>
                Send to admins
              </Button>
            </Stack>
          </form>
        ) : (
          <Text>Log in to send a support issue.</Text>
        )}
      </Stack>
    </Page>
  );
}
