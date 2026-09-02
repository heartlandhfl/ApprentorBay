import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { parsePasswordResetAction } from '@apprentorbay/shared';
import { Button, Card, Cluster, Input, Page, Stack, Text } from '../components';
import { signedInHomePath, useAuth } from '../lib/auth';

export function ResetPasswordPage() {
  const { account, loading, inspectPasswordResetCode, completePasswordReset } = useAuth();
  const location = useLocation();
  const action = parsePasswordResetAction({
    search: location.search,
    hash: location.hash,
  });
  const oobCode = action.kind === 'reset' ? action.oobCode : '';

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inspecting, setInspecting] = useState(Boolean(oobCode));

  useEffect(() => {
    if (!oobCode) {
      setInspecting(false);
      return;
    }
    let cancelled = false;
    setInspecting(true);
    setError(null);
    void inspectPasswordResetCode(oobCode)
      .then((nextEmail) => {
        if (!cancelled) setEmail(nextEmail);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setEmail(null);
          setError(err instanceof Error ? err.message : 'This reset link is not valid.');
        }
      })
      .finally(() => {
        if (!cancelled) setInspecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectPasswordResetCode, oobCode]);

  if (!loading && account) {
    return <Navigate to={signedInHomePath(account)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await completePasswordReset(oobCode, password, confirmPassword);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }

  const canSetPassword = Boolean(oobCode) && Boolean(email) && !inspecting && !saved;
  const missingLink = !oobCode || action.kind === 'other';

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Text variant="h1">Reset password</Text>
          <Text variant="muted">
            {canSetPassword
              ? `Choose a new password for ${email}.`
              : saved
                ? 'Your password is updated. Log in with the new one.'
                : 'Open the link in the reset email to choose a new password here.'}
          </Text>
        </Stack>
        <Card>
          {saved ? (
            <Stack gap={16}>
              <Text variant="muted">You can now log in with your new password.</Text>
              <Cluster gap={12}>
                <Button to="/login">Log in</Button>
              </Cluster>
            </Stack>
          ) : missingLink ? (
            <Stack gap={16}>
              {action.kind === 'other' ? (
                <Text variant="danger">
                  This link is not a password reset. Request a forgotten-password
                  email instead.
                </Text>
              ) : (
                <Text variant="muted">
                  The reset email contains a one-time link. If you have not
                  requested one yet, start from Forgotten password.
                </Text>
              )}
              <Cluster gap={12}>
                <Button to="/forgot-password">Forgotten password</Button>
                <Button variant="ghost" to="/login">
                  Back to log in
                </Button>
              </Cluster>
            </Stack>
          ) : (
            <form onSubmit={(event) => void onSubmit(event)}>
              <Stack gap={16}>
                {inspecting ? <Text variant="muted">Checking the reset link…</Text> : null}
                <Input
                  label="New password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  hint="At least 6 characters."
                  autoComplete="new-password"
                  disabled={!canSetPassword || busy}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={!canSetPassword || busy}
                />
                {error ? <Text variant="danger">{error}</Text> : null}
                <Cluster gap={12}>
                  <Button type="submit" loading={busy} disabled={!canSetPassword}>
                    Save new password
                  </Button>
                  <Button variant="ghost" to="/forgot-password">
                    Forgotten password
                  </Button>
                  <Button variant="ghost" to="/login">
                    Back to log in
                  </Button>
                </Cluster>
              </Stack>
            </form>
          )}
        </Card>
      </Stack>
    </Page>
  );
}
