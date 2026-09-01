import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  USER_ROLE,
  looksLikeFirebaseUid,
  type LearnerProfile,
  type PublicProfile,
} from '@apprentorbay/shared';
import {
  Button,
  Card,
  EmptyState,
  Page,
  Stack,
  Text,
} from '../components';
import { ProfileEditor } from '../features/profiles/ProfileEditor';
import { PortfolioSection, ProfilePhoto } from '../features/profiles/PublicProfileView';
import { watchLearnerProfile, watchPublicProfile } from '../features/profiles';
import { useAuth } from '../lib/auth';
import { getOwnProfile } from '../lib/api';

export function LearnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [own, setOwn] = useState<LearnerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocked = Boolean(id && looksLikeFirebaseUid(id));
  const isMeAlias = id === 'me' && account?.role === USER_ROLE.learner;
  const slug = isMeAlias ? account?.profileSlug ?? null : blocked ? null : id ?? null;
  const isOwner =
    Boolean(account) &&
    account?.role === USER_ROLE.learner &&
    (isMeAlias || Boolean(slug && account.profileSlug === slug));
  const canPreviewUnpublished = isOwner || account?.role === USER_ROLE.admin;

  useEffect(() => {
    if (!slug) {
      setPublicProfile(null);
      return;
    }
    setPublicProfile(undefined);
    return watchPublicProfile(slug, setPublicProfile, (err) => setError(err.message), {
      includeUnpublished: canPreviewUnpublished,
    });
  }, [account?.role, canPreviewUnpublished, slug]);

  useEffect(() => {
    if (!isOwner || !account) {
      setOwn(null);
      return;
    }
    void getOwnProfile()
      .then((body) => setOwn(body.profile as LearnerProfile))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load your profile'));
    return watchLearnerProfile(account.uid, (row) => {
      if (row) setOwn(row);
    });
  }, [account, isOwner]);

  return (
    <Page>
      {error ? (
        <EmptyState title="Could not load this profile" description={error} />
      ) : blocked ? (
        <EmptyState
          title="No public learner profile"
          description="Public profiles use a chosen URL, not an account id."
          action={
            <Button variant="secondary" to="/">
              Back home
            </Button>
          }
        />
      ) : publicProfile === undefined && !isOwner ? (
        <Text variant="muted">Loading profile…</Text>
      ) : !publicProfile && !isOwner ? (
        <EmptyState
          title="No public learner profile"
          description="This page is empty on purpose — the profile is missing or not public."
          action={
            <Button variant="secondary" to="/">
              Back home
            </Button>
          }
        />
      ) : (
        <LearnerBody
          publicProfile={publicProfile}
          own={isOwner ? own : null}
          isOwner={isOwner}
        />
      )}
    </Page>
  );
}

function LearnerBody({
  publicProfile,
  own,
  isOwner,
}: {
  publicProfile: PublicProfile | null | undefined;
  own: LearnerProfile | null;
  isOwner: boolean;
}) {
  const view = publicProfile;
  const name = view?.displayName || own?.displayName || 'Learner';
  const identity = view?.professionalIdentity || own?.professionalIdentity || '';
  const location = view?.location || (own?.locationPublic ? own.location : null);
  const education = view?.education ?? own?.education ?? [];
  const qualifications = view?.qualifications ?? own?.qualifications ?? [];
  const certifications = view?.certifications ?? own?.certifications ?? [];
  const careerStatus = view?.careerStatus || own?.jobStatus || '';
  const aspirations = view?.careerAspirations || own?.careerAspirations || '';
  const developing = view?.skillsDeveloping ?? own?.skillsDeveloping ?? [];
  const demonstrated = view?.skillsDemonstrated ?? own?.skillsDemonstrated ?? [];
  const portfolio = view?.portfolio ?? [];

  return (
    <Stack gap={32}>
      <Stack gap={16}>
        <Text variant="caption">Learner</Text>
        <ProfilePhoto path={view?.photoPath ?? own?.photoPath ?? null} name={name} />
        <Text variant="h1">{name}</Text>
        {identity ? <Text>{identity}</Text> : null}
        {location ? <Text variant="small">{location}</Text> : null}
        {isOwner && own && !own.public ? (
          <Text variant="small">This profile is hidden from public visitors.</Text>
        ) : null}
      </Stack>

      <PortfolioSection
        title="Portfolio"
        description="Completed deliverables and showcases. This is the public record of the learner's work."
        items={portfolio}
        empty="No published showcase yet"
        perspective="learner"
        featured
      />

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Competency development</Text>
          <Text variant="h3">Skills being developed</Text>
          {developing.length === 0 ? (
            <EmptyState title="No skills listed yet" />
          ) : (
            <Text>{developing.join(', ')}</Text>
          )}
          <Text variant="h3">Skills demonstrated</Text>
          {demonstrated.length === 0 ? (
            <EmptyState title="Skills appear here from completed work" />
          ) : (
            <Text>{demonstrated.join(', ')}</Text>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Career status</Text>
          {careerStatus.trim() ? <Text>{careerStatus}</Text> : <EmptyState title="No current status yet" />}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Career aspirations</Text>
          {aspirations.trim() ? <Text>{aspirations}</Text> : <EmptyState title="No career direction listed yet" />}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Traditional education</Text>
          <CredentialBlock title="Education" rows={education.map((item) => ({ title: item.credential, meta: [item.institution, item.year] }))} />
          <CredentialBlock title="Qualifications" rows={qualifications.map((item) => ({ title: item.title, meta: [item.issuer, item.year] }))} />
          <CredentialBlock title="Certifications" rows={certifications.map((item) => ({ title: item.title, meta: [item.issuer, item.year] }))} />
        </Stack>
      </Card>

      {isOwner && own ? <ProfileEditor role="learner" profile={own} /> : null}
    </Stack>
  );
}

function CredentialBlock({
  title,
  rows,
}: {
  title: string;
  rows: { title: string; meta: string[] }[];
}) {
  return (
    <Stack gap={8}>
      <Text variant="h3">{title}</Text>
      {rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} listed yet`} />
      ) : (
        rows.map((item, index) => (
          <Stack key={`${item.title}-${index}`} gap={4}>
            <Text>{item.title}</Text>
            <Text variant="small">{item.meta.filter(Boolean).join(' · ')}</Text>
          </Stack>
        ))
      )}
    </Stack>
  );
}
