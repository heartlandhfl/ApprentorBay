import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { SignupRole } from '@apprentorbay/shared';
import {
  Button,
  Card,
  Cluster,
  Input,
  Page,
  Stack,
  Stepper,
  Text,
  TextArea,
} from '../components';
import { profilePath, useAuth } from '../lib/auth';

const steps = [
  { id: 'role', label: 'Choose your role', description: 'Mentor or learner — one role, set here.' },
  { id: 'details', label: 'Your details', description: 'Email, password, and a name to show.' },
];

export function SignupPage() {
  const { account, loading, signUp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<SignupRole | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [careerAspirations, setCareerAspirations] = useState('');
  const [recentRole, setRecentRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && account) {
    return <Navigate to={profilePath(account)} replace />;
  }

  function chooseRole(next: SignupRole) {
    setRole(next);
    setStep(1);
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!role) {
      setError('Choose a role first');
      setStep(0);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await signUp({
        role,
        email,
        password,
        displayName,
        jobStatus,
        careerAspirations,
        recentRole,
      });
      navigate(profilePath(created));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Stack gap={32}>
        <Stack gap={12}>
          <Text variant="h1">Join the harbor</Text>
          <Text variant="muted">
            Pick one role. We create your account and an empty profile in the same
            write — nothing is left half-made.
          </Text>
        </Stack>

        <Stepper steps={steps} currentStep={step} onStepSelect={setStep} />

        {step === 0 ? (
          <Cluster gap={16}>
            <Card>
              <Stack gap={16}>
                <Text variant="h3">Learner</Text>
                <Text variant="small">
                  Apprentice a craft. Your public page starts empty until you add
                  education, goals, and deliverables.
                </Text>
                <Button onClick={() => chooseRole('learner')}>I am a learner</Button>
              </Stack>
            </Card>
            <Card>
              <Stack gap={16}>
                <Text variant="h3">Mentor</Text>
                <Text variant="small">
                  Guide someone through the work. New mentors start as Pending
                  Approval — never silently verified.
                </Text>
                <Button onClick={() => chooseRole('mentor')}>I am a mentor</Button>
              </Stack>
            </Card>
          </Cluster>
        ) : (
          <Card>
            <form onSubmit={(event) => void onSubmit(event)}>
              <Stack gap={16}>
                <Text variant="h3">
                  {role === 'mentor' ? 'Mentor account' : 'Learner account'}
                </Text>
                <Input
                  label="Display name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  autoComplete="name"
                />
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
                  minLength={6}
                  hint="At least 6 characters."
                  autoComplete="new-password"
                />
                {role === 'learner' ? (
                  <>
                    <Input
                      label="Job status"
                      value={jobStatus}
                      onChange={(event) => setJobStatus(event.target.value)}
                      hint="Optional. Leave blank to test the empty profile."
                    />
                    <TextArea
                      label="Career aspirations"
                      value={careerAspirations}
                      onChange={(event) => setCareerAspirations(event.target.value)}
                      hint="Optional."
                    />
                  </>
                ) : (
                  <Input
                    label="Recent role"
                    value={recentRole}
                    onChange={(event) => setRecentRole(event.target.value)}
                    hint="Optional. Skip to arrive with an empty mentor profile."
                  />
                )}
                {error ? <Text variant="danger">{error}</Text> : null}
                <Cluster gap={12}>
                  <Button type="submit" loading={busy}>
                    Create account
                  </Button>
                  <Button variant="ghost" to="/login">
                    I already have an account
                  </Button>
                </Cluster>
              </Stack>
            </form>
          </Card>
        )}
      </Stack>
    </Page>
  );
}
