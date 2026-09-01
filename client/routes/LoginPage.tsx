import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, Cluster, Input, Page, Stack, Text } from '../components';
import { signedInHomePath, useAuth } from '../lib/auth';

export function LoginPage() {
  const { account, loading, logIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && account) {
    return <Navigate to={signedInHomePath(account)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await logIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Text variant="h1">Welcome back</Text>
          <Text variant="muted">Email and password. Same door for every role.</Text>
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
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
              {error ? <Text variant="danger">{error}</Text> : null}
              <Cluster gap={12}>
                <Button type="submit" loading={busy}>
                  Log in
                </Button>
                <Button variant="ghost" to="/signup">
                  Create an account
                </Button>
              </Cluster>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Page>
  );
}
