import { useEffect, useState, type FormEvent } from 'react';
import {
  APPLICATION_STATUS,
  USER_ROLE,
  VERIFICATION_STATUS,
  isOpenRelationship,
  type MentorProfile,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Cluster,
  Modal,
  Text,
  TextArea,
} from '../../components';
import { useAuth } from '../../lib/auth';
import { createApplication, watchPairing } from './repository';

type ApplyMentorshipProps = {
  profile: MentorProfile;
};

export function ApplyMentorship({ profile }: ApplyMentorshipProps) {
  const { account, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [relationshipOpen, setRelationshipOpen] = useState(false);

  useEffect(() => {
    if (!account || account.role !== USER_ROLE.learner || account.uid === profile.userId) {
      return;
    }
    return watchPairing(account.uid, profile.userId, (state) => {
      setApplicationStatus(state.application?.status ?? null);
      setRelationshipId(state.relationship?.id ?? null);
      setRelationshipOpen(Boolean(state.relationship && isOpenRelationship(state.relationship)));
    });
  }, [account, profile.userId]);

  if (loading) return null;
  if (profile.verificationStatus !== VERIFICATION_STATUS.approved) return null;
  if (!account) {
    return (
      <Button variant="secondary" to="/login">
        Log in to apply
      </Button>
    );
  }
  if (account.role !== USER_ROLE.learner) return null;
  if (account.uid === profile.userId) return null;

  if (relationshipId && relationshipOpen) {
    return (
      <Button to={`/dashboard/mentorships/${relationshipId}`}>Open mentorship</Button>
    );
  }

  if (applicationStatus === APPLICATION_STATUS.pending) {
    return <Badge tone="accent">Application pending</Badge>;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      await createApplication({
        learnerId: account.uid,
        mentorId: profile.userId,
        message,
      });
      setOpen(false);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send application');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Apply for Mentorship</Button>
      <Modal
        open={open}
        title={`Write to ${profile.displayName}`}
        onClose={() => setOpen(false)}
        footer={
          <Cluster gap={8}>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="apply-mentorship"
              loading={busy}
            >
              Send application
            </Button>
          </Cluster>
        }
      >
        <form id="apply-mentorship" onSubmit={(event) => void onSubmit(event)}>
          <TextArea
            label="Short message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={1000}
            hint="Say what you want to learn. Mentors see this before they accept."
          />
        </form>
        {error ? <Text variant="danger">{error}</Text> : null}
      </Modal>
    </>
  );
}
