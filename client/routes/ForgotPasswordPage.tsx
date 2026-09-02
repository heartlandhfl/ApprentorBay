import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, Cluster, Input, Page, Stack, Text } from '../components';
import { signedInHomePath, useAuth } from '../lib/auth';

export function ForgotPasswordPage() {
  const { account, loading, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!loading && account) {
    return <Navigate to={signedInHomePath(account)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Text variant="h1">Forgotten password</Text>
          <Text variant="muted">
            Enter the email you use to log in. If that address has an account, we
            send a reset link.
          </Text>
        </Stack>
        <Card>
          <form onSubmit={(event) => void onSubmit(event)}>
            <Stack gap={16}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
              {error ? <Text variant="danger">{error}</Text> : null}
              {sent ? (
                <Text variant="muted">
                  If that inbox has an account, a reset email is on its way. Open
                  the link, then choose a new password.
                </Text>
              ) : null}
              <Cluster gap={12}>
                <Button type="submit" loading={busy}>
                  Send reset email
                </Button>
                <Button variant="ghost" to="/reset-password">
                  Reset password
                </Button>
                <Button variant="ghost" to="/login">
                  Back to log in
                </Button>
              </Cluster>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Page>
  );
}
