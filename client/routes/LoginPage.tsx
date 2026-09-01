import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Button, Card, Cluster, Input, Page, Stack, Text } from '../components';
import { signedInHomePath, useAuth } from '../lib/auth';
import { getFirebaseAuth } from '../lib/firebase';

export function LoginPage() {
  const { account, loading, logIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && account) {
    return <Navigate to={signedInHomePath(account)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
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
              {info ? <Text variant="muted">{info}</Text> : null}
              <Cluster gap={12}>
                <Button type="submit" loading={busy}>
                  Log in
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busy || !email.trim()}
                  onClick={() => {
                    const auth = getFirebaseAuth();
                    if (!auth) {
                      setError('Firebase is not initialized');
                      return;
                    }
                    setBusy(true);
                    setError(null);
                    setInfo(null);
                    void sendPasswordResetEmail(auth, email.trim())
                      .then(() => {
                        setInfo('Password reset email sent. Check that inbox, then log in here.');
                      })
                      .catch(() => {
                        setError('Could not send a reset email. Confirm the address exists in Firebase Auth.');
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  Reset password
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
