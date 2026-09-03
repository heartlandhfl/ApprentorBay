import { useEffect, useState, type FormEvent } from 'react';
import {
  APPLICATION_STATUS,
  APPROVAL_STATUS,
  USER_ROLE,
  isOpenRelationship,
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
import { applyToMentor, resolveMentorApplyTarget } from '../../lib/api';
import { watchPairing } from './repository';

type ApplyMentorshipProps = {
  slug: string;
  displayName: string;
  approvalStatus: string;
  acceptsNewLearners?: boolean;
};

export function ApplyMentorship({
  slug,
  displayName,
  approvalStatus,
  acceptsNewLearners = true,
}: ApplyMentorshipProps) {
  const { account, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [relationshipOpen, setRelationshipOpen] = useState(false);

  useEffect(() => {
    if (!account || account.role !== USER_ROLE.learner) return;
    let cancelled = false;
    void resolveMentorApplyTarget(slug)
      .then((result) => {
        if (!cancelled) setMentorId(result.mentorId);
      })
      .catch(() => {
        if (!cancelled) setMentorId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account, slug]);

  useEffect(() => {
    if (!account || account.role !== USER_ROLE.learner || !mentorId || account.uid === mentorId) {
      return;
    }
    return watchPairing(account.uid, mentorId, (state) => {
      setApplicationStatus(state.application?.status ?? null);
      setRelationshipId(state.relationship?.id ?? null);
      setRelationshipOpen(Boolean(state.relationship && isOpenRelationship(state.relationship)));
    });
  }, [account, mentorId]);

  if (loading) return null;
  if (approvalStatus !== APPROVAL_STATUS.approved) return null;
  if (!acceptsNewLearners) return null;
  if (!account) {
    return (
      <Button variant="secondary" to="/login">
        Log in to apply
      </Button>
    );
  }
  if (account.role !== USER_ROLE.learner) return null;
  if (mentorId && account.uid === mentorId) return null;

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
      await applyToMentor(slug, message);
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
        title={`Write to ${displayName}`}
        onClose={() => setOpen(false)}
        footer={
          <Cluster gap={8}>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="apply-mentorship" loading={busy}>
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
