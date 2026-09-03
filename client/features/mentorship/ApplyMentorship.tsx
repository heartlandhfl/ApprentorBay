import { useEffect, useState, type FormEvent } from 'react';
import {
  APPLICATION_STATUS,
  APPROVAL_STATUS,
  USER_ROLE,
  isOpenRelationship,
  isPaidCommercialMode,
  mentorAvailabilityCopy,
  mentorMessagingCopy,
  mentorPrimaryActionLabel,
  mentorVideoSessionCopy,
  type CommercialMode,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Cluster,
  Modal,
  Stack,
  Text,
  TextArea,
} from '../../components';
import { useAuth } from '../../lib/auth';
import { applyToMentor, resolveMentorApplyTarget } from '../../lib/api';
import { watchPairing } from './repository';

export type MentorApplyOffering = {
  commercialMode: CommercialMode;
  priceLabel: string;
  helpWith: string;
  mentorTypeLabel: string;
  serviceModelLabel: string;
  serviceModelDescription: string;
  offersVideoSessions: boolean;
  includedMessaging: boolean;
};

type ApplyMentorshipProps = {
  slug: string;
  displayName: string;
  approvalStatus: string;
  acceptsNewLearners?: boolean;
  offering: MentorApplyOffering;
};

export function ApplyMentorship({
  slug,
  displayName,
  approvalStatus,
  acceptsNewLearners = true,
  offering,
}: ApplyMentorshipProps) {
  const { account, loading } = useAuth();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [relationshipOpen, setRelationshipOpen] = useState(false);

  const isPaid = isPaidCommercialMode(offering.commercialMode);
  const primaryLabel = mentorPrimaryActionLabel(offering.commercialMode);

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
  if (!acceptsNewLearners) {
    return <Text variant="small">{mentorAvailabilityCopy(false)}</Text>;
  }
  if (!account) {
    return (
      <Button variant="secondary" to="/login">
        Log in to {isPaid ? 'view options' : 'request mentorship'}
      </Button>
    );
  }
  if (account.role !== USER_ROLE.learner) return null;
  if (mentorId && account.uid === mentorId) return null;

  if (relationshipId && relationshipOpen) {
    return <Button to={`/dashboard/mentorships/${relationshipId}`}>Open mentorship</Button>;
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
      setApplyOpen(false);
      setOptionsOpen(false);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send application');
    } finally {
      setBusy(false);
    }
  }

  function openPrimaryAction() {
    if (isPaid) {
      setOptionsOpen(true);
      return;
    }
    setApplyOpen(true);
  }

  return (
    <>
      <Button onClick={openPrimaryAction}>{primaryLabel}</Button>

      <Modal
        open={optionsOpen}
        title="Mentorship options"
        onClose={() => setOptionsOpen(false)}
        footer={
          <Cluster gap={8}>
            <Button variant="secondary" onClick={() => setOptionsOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setOptionsOpen(false);
                setApplyOpen(true);
              }}
            >
              Request mentorship
            </Button>
          </Cluster>
        }
      >
        <Stack gap={16}>
          <Text variant="small">
            Payment is not handled in ApprentorBay yet. You can still request mentorship and
            agree on details with {displayName} directly.
          </Text>
          <Stack gap={8}>
            <Text variant="caption">Experience type</Text>
            <Text variant="h3">{offering.mentorTypeLabel}</Text>
          </Stack>
          <Stack gap={8}>
            <Text variant="caption">Service model</Text>
            <Text variant="h3">{offering.serviceModelLabel}</Text>
            <Text variant="small">{offering.serviceModelDescription}</Text>
          </Stack>
          <Stack gap={8}>
            <Text variant="caption">Price</Text>
            <Text variant="h3">{offering.priceLabel}</Text>
          </Stack>
          {offering.helpWith ? (
            <Stack gap={8}>
              <Text variant="caption">What you will work on</Text>
              <Text>{offering.helpWith}</Text>
            </Stack>
          ) : null}
          <Text variant="small">
            {mentorVideoSessionCopy(offering.offersVideoSessions)} ·{' '}
            {mentorMessagingCopy(offering.includedMessaging)}
          </Text>
        </Stack>
      </Modal>

      <Modal
        open={applyOpen}
        title={`Request mentorship with ${displayName}`}
        onClose={() => setApplyOpen(false)}
        footer={
          <Cluster gap={8}>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="apply-mentorship" loading={busy}>
              Send request
            </Button>
          </Cluster>
        }
      >
        <form id="apply-mentorship" onSubmit={(event) => void onSubmit(event)}>
          <Stack gap={16}>
            {isPaid ? (
              <Text variant="small">
                {offering.serviceModelLabel} · {offering.priceLabel}. Payment will be arranged
                outside the platform for now.
              </Text>
            ) : (
              <Text variant="small">This mentor offers free mentorship through Giving Back.</Text>
            )}
            <TextArea
              label="Your message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              maxLength={1000}
              hint="Say what you want to learn and why this mentor is a good fit."
            />
          </Stack>
        </form>
        {error ? <Text variant="danger">{error}</Text> : null}
      </Modal>
    </>
  );
}
