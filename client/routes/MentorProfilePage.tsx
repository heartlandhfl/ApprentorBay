import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  USER_ROLE,
  looksLikeFirebaseUid,
  type MentorProfile,
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
import { ApplyMentorship } from '../features/mentorship';
import { ProfileEditor } from '../features/profiles/ProfileEditor';
import {
  MentorMarketplaceHero,
  mentorOfferingForApply,
} from '../features/profiles/MentorMarketplaceProfile';
import { PortfolioSection } from '../features/profiles/PublicProfileView';
import { watchMentorProfile, watchPublicProfile } from '../features/profiles';
import { useAuth } from '../lib/auth';
import { getOwnProfile } from '../lib/api';

export function MentorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { account } = useAuth();
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [own, setOwn] = useState<MentorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocked = Boolean(id && looksLikeFirebaseUid(id));
  const isMeAlias = id === 'me' && account?.role === USER_ROLE.mentor;
  const slug = isMeAlias ? account?.profileSlug ?? null : blocked ? null : id ?? null;
  const isOwner =
    Boolean(account) &&
    account?.role === USER_ROLE.mentor &&
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
      .then((body) => setOwn(body.profile as MentorProfile))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load your profile'));
    return watchMentorProfile(account.uid, (row) => {
      if (row) setOwn(row);
    });
  }, [account, isOwner]);

  return (
    <Page>
      {error ? (
        <EmptyState title="Could not load this profile" description={error} />
      ) : blocked ? (
        <EmptyState
          title="No public mentor profile"
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
          title="No public mentor profile"
          description="This page is empty on purpose — the profile is missing or not public."
          action={
            <Button variant="secondary" to="/">
              Back home
            </Button>
          }
        />
      ) : (
        <MentorBody publicProfile={publicProfile} own={isOwner ? own : null} isOwner={isOwner} slug={slug ?? ''} />
      )}
    </Page>
  );
}

function MentorBody({
  publicProfile,
  own,
  isOwner,
  slug,
}: {
  publicProfile: PublicProfile | null | undefined;
  own: MentorProfile | null;
  isOwner: boolean;
  slug: string;
}) {
  const view = publicProfile;
  const name = view?.displayName || own?.displayName || 'Mentor';
  const identity = view?.professionalIdentity || own?.professionalIdentity || own?.expertise || '';
  const location = view?.location || (own?.locationPublic ? own.location : null);
  const education = view?.education ?? own?.education ?? [];
  const experience = view?.experience ?? own?.experience ?? [];
  const expertise = view?.areasOfExpertise?.length
    ? view.areasOfExpertise
    : own?.areasOfExpertise?.length
      ? own.areasOfExpertise
      : own?.expertise
        ? [own.expertise]
        : [];
  const goals = view?.professionalGoals || own?.professionalGoals || '';
  const mentoring = view?.mentoringInterests || own?.mentoringInterests || '';
  const reviews = view?.reviews ?? [];
  const mentored = view?.mentoredDeliverables ?? [];

  return (
    <Stack gap={32}>
      {view ? (
        <MentorMarketplaceHero
          profile={view}
          name={name}
          identity={identity}
          location={location}
          photoPath={view.photoPath ?? own?.photoPath ?? null}
        >
          <ApplyMentorship
            slug={slug}
            displayName={name}
            approvalStatus={view.approvalStatus}
            acceptsNewLearners={view.acceptsNewLearners !== false}
            offering={mentorOfferingForApply(view)}
          />
        </MentorMarketplaceHero>
      ) : null}

      {isOwner && own && own.verificationStatus !== 'approved' ? (
        <Text variant="small">Public visitors see this profile after participation is approved.</Text>
      ) : null}

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Education</Text>
          {education.length === 0 ? (
            <EmptyState title="No education listed yet" />
          ) : (
            education.map((item) => (
              <Stack key={item.id} gap={4}>
                <Text variant="h3">{item.credential}</Text>
                <Text variant="small">{[item.institution, item.year].filter(Boolean).join(' · ')}</Text>
              </Stack>
            ))
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Professional experience</Text>
          {experience.length === 0 ? (
            <EmptyState title="No experience listed yet" />
          ) : (
            experience.map((item) => (
              <Stack key={item.id} gap={4}>
                <Text variant="h3">{item.title || 'Role'}</Text>
                <Text variant="small">{[item.organization, item.year].filter(Boolean).join(' · ')}</Text>
                {item.summary ? <Text>{item.summary}</Text> : null}
              </Stack>
            ))
          )}
        </Stack>
      </Card>

      {expertise.length > 0 ? (
        <Card>
          <Stack gap={16}>
            <Text variant="h2">Areas of expertise</Text>
            <Text>{expertise.join(', ')}</Text>
          </Stack>
        </Card>
      ) : null}

      {goals.trim() ? (
        <Card>
          <Stack gap={16}>
            <Text variant="h2">Professional goals / interests</Text>
            <Text>{goals}</Text>
          </Stack>
        </Card>
      ) : null}

      {mentoring.trim() && mentoring !== view?.servicesDescription ? (
        <Card>
          <Stack gap={16}>
            <Text variant="h2">Mentoring interests</Text>
            <Text>{mentoring}</Text>
          </Stack>
        </Card>
      ) : null}

      <PortfolioSection
        title="Mentored deliverables"
        description="These are works the mentor guided. The learner remains the creator."
        items={mentored}
        empty="No mentored deliverables yet"
        perspective="mentor"
      />

      <Card>
        <Stack gap={16}>
          <Text variant="h2">Reviews</Text>
          {reviews.length === 0 ? (
            <EmptyState title="No reviews yet" />
          ) : (
            reviews.map((review) => (
              <Stack key={review.id} gap={4}>
                <Text variant="h3">{review.authorName}</Text>
                <Text variant="small">Rating {review.rating} / 5</Text>
                <Text>{review.body}</Text>
              </Stack>
            ))
          )}
        </Stack>
      </Card>

      {isOwner && own ? <ProfileEditor role="mentor" profile={own} /> : null}
    </Stack>
  );
}
