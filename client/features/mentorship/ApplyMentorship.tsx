import { useEffect, useState, type FormEvent } from 'react';
import {
  APPLICATION_STATUS,
  APPROVAL_STATUS,
  COMMERCIAL_MODE,
  REQUEST_TYPE,
  USER_ROLE,
  buildMentorshipOfferingView,
  isOpenRelationship,
  paidMentorshipServicesBlocked,
  requestTypePublicLabel,
  type PublicProfile,
  type RequestType,
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
import {
  applyToMentor,
  createMentorshipBooking,
  resolveMentorApplyTarget,
  startPaymentCheckout,
} from '../../lib/api';
import {
  MentorshipOfferingCard,
  MentorshipOfferingCardButton,
} from '../profiles/MentorshipOfferingCard';
import { watchPairing } from './repository';

type ApplyMentorshipProps = {
  slug: string;
  displayName: string;
  approvalStatus: string;
  acceptsNewLearners?: boolean;
  profile: PublicProfile;
};

export function ApplyMentorship({
  slug,
  displayName,
  approvalStatus,
  acceptsNewLearners = true,
  profile,
}: ApplyMentorshipProps) {
  const { account, loading } = useAuth();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentSatisfied, setPaymentSatisfied] = useState(false);

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
      setRequestType(state.application?.requestType ?? null);
      setRelationshipId(state.relationship?.id ?? null);
      setRelationshipOpen(Boolean(state.relationship && isOpenRelationship(state.relationship)));
      setPaymentRequired(state.relationship?.paymentRequired === true);
      setPaymentSatisfied(state.relationship?.paymentSatisfied === true);
    });
  }, [account, mentorId]);

  const offering = buildMentorshipOfferingView({
    commercialMode: profile.commercialMode ?? COMMERCIAL_MODE.givingBack,
    mentorType: profile.mentorType,
    baseSessionPriceUsd: profile.baseSessionPriceUsd ?? null,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    serviceDescription: profile.serviceDescription,
    mentoringInterests: profile.mentoringInterests,
    areasOfExpertise: profile.areasOfExpertise,
    offersVideoSessions: profile.offersVideoSessions,
    includedMessaging: profile.includedMessaging,
    mentorName: displayName,
    hasActiveRelationship: relationshipOpen,
    paymentRequired,
    paymentSatisfied,
  });

  if (loading) return null;
  if (approvalStatus !== APPROVAL_STATUS.approved) return null;
  if (!acceptsNewLearners) {
    return <Text variant="small">Not currently accepting new learners</Text>;
  }
  if (!account) {
    return (
      <MentorshipOfferingCardButton
        label={`Log in to ${offering.primaryActionLabel.toLowerCase()}`}
        to="/login"
      />
    );
  }
  if (account.role !== USER_ROLE.learner) return null;
  if (mentorId && account.uid === mentorId) return null;

  if (relationshipId && relationshipOpen && paymentSatisfied) {
    return (
      <MentorshipOfferingCardButton
        label="Open mentorship"
        to={`/dashboard/mentorships/${relationshipId}`}
      />
    );
  }

  if (applicationStatus === APPLICATION_STATUS.pending) {
    return (
      <Badge tone="accent">
        {requestTypePublicLabel(requestType ?? undefined)} pending
      </Badge>
    );
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

  async function onBookAndPay() {
    if (!relationshipId) return;
    setBusy(true);
    setError(null);
    try {
      const { booking } = await createMentorshipBooking({ relationshipId });
      const checkout = await startPaymentCheckout(booking.id);
      window.location.assign(checkout.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setBusy(false);
    }
  }

  function openPrimaryAction() {
    if (
      relationshipId &&
      relationshipOpen &&
      paidMentorshipServicesBlocked({
        paymentRequired,
        paymentSatisfied,
        requestType: offering.isPaid ? REQUEST_TYPE.paidRequest : REQUEST_TYPE.freeRequest,
      })
    ) {
      void onBookAndPay();
      return;
    }
    if (offering.isPaid) {
      setOptionsOpen(true);
      return;
    }
    setApplyOpen(true);
  }

  const primaryLabel =
    relationshipId && relationshipOpen && paymentRequired && !paymentSatisfied
      ? 'Book and pay'
      : offering.primaryActionLabel;

  return (
    <>
      <MentorshipOfferingCardButton label={primaryLabel} onClick={openPrimaryAction} loading={busy} />

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
        <MentorshipOfferingCard offering={offering} compact />
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
              {offering.isPaid ? 'Send request' : 'Send free request'}
            </Button>
          </Cluster>
        }
      >
        <form id="apply-mentorship" onSubmit={(event) => void onSubmit(event)}>
          <Stack gap={16}>
            <MentorshipOfferingCard offering={offering} compact />
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

      {error && !applyOpen && !optionsOpen ? <Text variant="danger">{error}</Text> : null}
    </>
  );
}
