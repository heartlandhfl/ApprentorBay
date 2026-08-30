import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { MentorshipRelationship, Message } from '@apprentorbay/shared';
import {
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
import {
  firestoreDenied,
  sendMessage,
  watchMessages,
  watchRelationship,
} from '../features/mentorship';
import { getPublicDisplayName } from '../features/profiles';
import { useAuth } from '../lib/auth';

export function MessagesPage() {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const { account } = useAuth();
  const [relationship, setRelationship] = useState<MentorshipRelationship | null | undefined>(
    undefined,
  );
  const [denied, setDenied] = useState(false);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState('Member');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
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
        const member = next.learnerId === account.uid || next.mentorId === account.uid;
        if (!member) {
          setDenied(true);
          return;
        }
        setRelationship(next);
        const otherId = next.learnerId === account.uid ? next.mentorId : next.learnerId;
        void getPublicDisplayName(otherId).then(setOtherName);
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

  if (denied) {
    return (
      <Navigate
        to="/dashboard/messages"
        replace
        state={{ notice: 'That conversation is not yours. Firestore refused the read.' }}
      />
    );
  }

  if (missing) {
    return (
      <Page>
        <EmptyState
          title="No conversation here"
          description="This relationship does not exist."
          action={
            <Button variant="secondary" to="/dashboard/messages">
              Back to messages
            </Button>
          }
        />
      </Page>
    );
  }

  if (!relationship || !account || !relationshipId) {
    return (
      <Page>
        <Text variant="muted">Opening conversation…</Text>
      </Page>
    );
  }

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

  const ended = relationship.status !== 'active';

  return (
    <Page>
      <Stack gap={24}>
        <Stack gap={12}>
          <Button variant="ghost" size="sm" to="/dashboard/messages">
            All conversations
          </Button>
          <Text variant="h1">With {otherName}</Text>
          <Text variant="muted">
            Real-time, and only for the two of you. A third account cannot open this URL.
          </Text>
        </Stack>

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

        {ended ? (
          <EmptyState title="This pairing has ended" />
        ) : (
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
        )}
      </Stack>
    </Page>
  );
}
