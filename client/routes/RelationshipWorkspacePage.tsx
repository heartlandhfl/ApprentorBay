import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  RELATIONSHIP_STATUS,
  RELATIONSHIP_STATUS_LABEL,
  USER_ROLE,
  canEndRelationship,
  canPauseRelationship,
  canResumeRelationship,
  isPairingMember,
  type LearnerProfile,
  type MentorProfile,
  type MentorshipRelationship,
  type Message,
} from '@apprentorbay/shared';
import {
  Badge,
  Button,
  Card,
  Cluster,
  EmptyState,
  MessageBubble,
  Page,
  Stack,
  Text,
  TextArea,
} from '../components';
import { JourneyEntry } from '../features/learning-contracts';
import { SessionsPanel } from '../features/sessions';
import {
  RelationshipPaymentBanner,
  firestoreDenied,
  sendMessage,
  watchMessages,
  watchRelationship,
} from '../features/mentorship';
import { watchLearnerProfile, watchMentorProfile } from '../features/profiles';
import { setRelationshipStatus } from '../lib/api';
import { useAuth } from '../lib/auth';

export function RelationshipWorkspacePage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const { account } = useAuth();
  const [relationship, setRelationship] = useState<MentorshipRelationship | null | undefined>(
    undefined,
  );
  const [denied, setDenied] = useState(false);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [learner, setLearner] = useState<LearnerProfile | null>(null);
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!relationshipId || !account) return;

    const unsubRel = watchRelationship(
      relationshipId,
      (next) => {
        if (!next) {
          setMissing(true);
          setRelationship(null);
          return;
        }
        if (!isPairingMember(account.uid, next) && account.role !== USER_ROLE.admin) {
          setDenied(true);
          return;
        }
        setRelationship(next);
      },
      (err) => {
        if (firestoreDenied(err)) {
          setDenied(true);
          return;
        }
        setError(err.message);
      },
    );

    const unsubMsgs = watchMessages(
      relationshipId,
      setMessages,
      (err) => {
        if (firestoreDenied(err)) {
          setDenied(true);
          return;
        }
        setError(err.message);
      },
    );

    return () => {
      unsubRel();
      unsubMsgs();
    };
  }, [account, relationshipId]);

  useEffect(() => {
    if (!relationship) return;
    const unsubLearner = watchLearnerProfile(relationship.learnerId, setLearner);
    const unsubMentor = watchMentorProfile(relationship.mentorId, setMentor);
    return () => {
      unsubLearner();
      unsubMentor();
    };
  }, [relationship]);

  if (denied) {
    return (
      <Navigate
        to="/dashboard/mentorships"
        replace
        state={{ notice: 'That mentorship is not yours. Firestore refused the read.' }}
      />
    );
  }

  if (missing) {
    return (
      <Page>
        <EmptyState
          title="No mentorship here"
          description="This relationship does not exist."
          action={
            <Button variant="secondary" to="/dashboard/mentorships">
              Back to mentorships
            </Button>
          }
        />
      </Page>
    );
  }

  if (!relationship || !account || !relationshipId) {
    return (
      <Page>
        <Text variant="muted">Opening workspace…</Text>
      </Page>
    );
  }

  const learnerName = learner?.displayName || 'Learner';
  const mentorName = mentor?.displayName || 'Mentor';
  const otherName = account.uid === relationship.learnerId ? mentorName : learnerName;
  const active = relationship.status === RELATIONSHIP_STATUS.active;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account || !relationshipId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendMessage({
        relationshipId,
        senderId: account.uid,
        text: draft,
      });
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: typeof RELATIONSHIP_STATUS.active | typeof RELATIONSHIP_STATUS.paused | typeof RELATIONSHIP_STATUS.ended) {
    if (!relationship) return;
    setStatusBusy(true);
    setError(null);
    try {
      await setRelationshipStatus(relationship.id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the relationship');
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Button variant="ghost" size="sm" to="/dashboard/mentorships">
            All mentorships
          </Button>
          <Cluster gap={12}>
            <Text variant="h1">Mentorship with {otherName}</Text>
            <Badge
              tone={
                relationship.status === RELATIONSHIP_STATUS.active
                  ? 'success'
                  : relationship.status === RELATIONSHIP_STATUS.paused
                    ? 'accent'
                    : 'neutral'
              }
            >
              {RELATIONSHIP_STATUS_LABEL[relationship.status]}
            </Badge>
          </Cluster>
          <Text variant="muted">
            Dedicated relationship workspace. Only the learner, the mentor, and
            admins can open this page.
          </Text>
        </Stack>

        <Cluster gap={8}>
          {canPauseRelationship(account, relationship) ? (
            <Button
              variant="secondary"
              size="sm"
              loading={statusBusy}
              onClick={() => void changeStatus(RELATIONSHIP_STATUS.paused)}
            >
              Pause
            </Button>
          ) : null}
          {canResumeRelationship(account, relationship) ? (
            <Button
              size="sm"
              loading={statusBusy}
              onClick={() => void changeStatus(RELATIONSHIP_STATUS.active)}
            >
              Resume
            </Button>
          ) : null}
          {canEndRelationship(account, relationship) ? (
            <Button
              variant="danger"
              size="sm"
              loading={statusBusy}
              onClick={() => void changeStatus(RELATIONSHIP_STATUS.ended)}
            >
              End mentorship
            </Button>
          ) : null}
        </Cluster>

        <RelationshipPaymentBanner relationship={relationship} account={account} />

        <Stack gap={16}>
          <Text variant="h2">People</Text>
          <div className="grid gap-16 md:grid-cols-2">
            <PartyCard
              role="Mentor"
              name={mentorName}
              detail={mentor?.expertise || 'No expertise listed yet'}
              href={mentor?.slug ? `/mentors/${mentor.slug}` : null}
            />
            <PartyCard
              role="Learner"
              name={learnerName}
              detail={learner?.careerAspirations || learner?.jobStatus || 'No goals listed yet'}
              href={learner?.slug ? `/learners/${learner.slug}` : null}
            />
          </div>
        </Stack>

        <JourneyEntry
          relationship={relationship}
          account={account}
          otherName={otherName}
        />

        <SessionsPanel
          relationship={relationship}
          account={account}
          learner={learner}
          mentor={mentor}
        />

        <Stack gap={12}>
          <Text variant="h2">Messages</Text>
          <Card padding="lg">
            <Stack gap={16}>
              {messages.length === 0 ? (
                <EmptyState title="No messages yet" description="Say hello. They will see it live." />
              ) : (
                <Stack gap={12}>
                  {messages.map((item) => (
                    <MessageBubble
                      key={item.id}
                      mine={item.senderId === account.uid}
                      author={item.senderId === account.uid ? 'You' : otherName}
                      text={item.text}
                      time={new Date(item.createdAt).toLocaleString()}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>

          {active ? (
            <form onSubmit={(event) => void onSubmit(event)}>
              <Stack gap={12}>
                <TextArea
                  label="Message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  required
                  maxLength={2000}
                />
                {error ? <Text variant="danger">{error}</Text> : null}
                <Cluster gap={8}>
                  <Button type="submit" loading={busy} disabled={!draft.trim()}>
                    Send
                  </Button>
                </Cluster>
              </Stack>
            </form>
          ) : (
            <EmptyState
              title={
                relationship.status === RELATIONSHIP_STATUS.paused
                  ? 'This mentorship is paused'
                  : 'This mentorship has ended'
              }
              description="History stays visible. New messages and new learning contracts are locked."
            />
          )}
          {error && !active ? <Text variant="danger">{error}</Text> : null}
        </Stack>
      </Stack>
    </Page>
  );
}

function PartyCard({
  role,
  name,
  detail,
  href,
}: {
  role: string;
  name: string;
  detail: string;
  href: string | null;
}) {
  return (
    <Card>
      <Stack gap={12}>
        <Text variant="caption">{role}</Text>
        <Text variant="h3">{name}</Text>
        <Text variant="small">{detail}</Text>
        {href ? (
          <Button variant="ghost" size="sm" to={href}>
            View profile
          </Button>
        ) : null}
      </Stack>
    </Card>
  );
}
