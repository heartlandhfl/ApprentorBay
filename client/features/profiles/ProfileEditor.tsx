import { useState, type FormEvent } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  COMMERCIAL_MODE,
  COMMERCIAL_MODE_DESCRIPTION,
  COMMERCIAL_MODE_LABEL,
  COMMERCIAL_MODES_FOR_MENTOR_TYPE,
  MENTOR_TYPE,
  MENTOR_TYPE_DESCRIPTION,
  MENTOR_TYPE_LABEL,
  VERIFICATION_STATUS,
  commercialModeAllowedForMentorType,
  profilePhotoStoragePath,
  type CommercialMode,
  type CredentialEntry,
  type EducationEntry,
  type ExperienceEntry,
  type LearnerProfile,
  type MentorProfile,
  type MentorType,
} from '@apprentorbay/shared';
import { Button, Card, Checkbox, FileField, Input, Stack, Text, TextArea } from '../../components';
import { getFirebaseStorage } from '../../lib/firebase';
import { submitMentorVerification, updateOwnProfile } from '../../lib/api';

type ProfileEditorProps = {
  role: 'learner' | 'mentor';
  profile: LearnerProfile | MentorProfile;
  onSaved?: () => void;
};

function asLearner(profile: LearnerProfile | MentorProfile): LearnerProfile | null {
  return 'jobStatus' in profile ? (profile as LearnerProfile) : null;
}

function asMentor(profile: LearnerProfile | MentorProfile): MentorProfile | null {
  return 'verificationStatus' in profile ? (profile as MentorProfile) : null;
}

export function ProfileEditor({ role, profile, onSaved }: ProfileEditorProps) {
  const learner = asLearner(profile);
  const mentor = asMentor(profile);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [professionalIdentity, setProfessionalIdentity] = useState(profile.professionalIdentity);
  const [location, setLocation] = useState(profile.location);
  const [locationPublic, setLocationPublic] = useState(profile.locationPublic);
  const [slug, setSlug] = useState(profile.slug ?? '');
  const [published, setPublished] = useState(profile.public);
  const [education, setEducation] = useState(linesFromEducation(profile.education));
  const [qualifications, setQualifications] = useState(linesFromCredentials(profile.qualifications));
  const [certifications, setCertifications] = useState(linesFromCredentials(profile.certifications));
  const [jobStatus, setJobStatus] = useState(learner?.jobStatus ?? '');
  const [careerAspirations, setCareerAspirations] = useState(learner?.careerAspirations ?? '');
  const [skillsDeveloping, setSkillsDeveloping] = useState((learner?.skillsDeveloping ?? []).join(', '));
  const [skillsDemonstrated, setSkillsDemonstrated] = useState((learner?.skillsDemonstrated ?? []).join(', '));
  const [expertise, setExpertise] = useState(mentor?.expertise ?? '');
  const [areas, setAreas] = useState((mentor?.areasOfExpertise ?? []).join(', '));
  const [experience, setExperience] = useState(linesFromExperience(mentor?.experience ?? []));
  const [professionalGoals, setProfessionalGoals] = useState(mentor?.professionalGoals ?? '');
  const [mentoringInterests, setMentoringInterests] = useState(mentor?.mentoringInterests ?? '');
  const [mentorType, setMentorType] = useState<MentorType>(
    mentor?.mentorType ?? MENTOR_TYPE.accomplished,
  );
  const [commercialMode, setCommercialMode] = useState<CommercialMode>(
    mentor?.commercialMode ?? COMMERCIAL_MODE.givingBack,
  );
  const [servicesDescription, setServicesDescription] = useState(mentor?.servicesDescription ?? '');
  const [sessionPriceUsd, setSessionPriceUsd] = useState(
    mentor?.sessionPriceUsd != null ? String(mentor.sessionPriceUsd) : '',
  );
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(
    mentor?.sessionDurationMinutes != null ? String(mentor.sessionDurationMinutes) : '',
  );
  const [offersVideoSessions, setOffersVideoSessions] = useState(mentor?.offersVideoSessions === true);
  const [messagingIncluded, setMessagingIncluded] = useState(mentor?.messagingIncluded !== false);
  const [acceptsNewLearners, setAcceptsNewLearners] = useState(mentor?.acceptsNewLearners !== false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mentorApproved = mentor?.verificationStatus === VERIFICATION_STATUS.approved;
  const allowedCommercialModes = COMMERCIAL_MODES_FOR_MENTOR_TYPE[mentorType];

  function onMentorTypeChange(nextType: MentorType) {
    setMentorType(nextType);
    if (!commercialModeAllowedForMentorType(nextType, commercialMode)) {
      setCommercialMode(COMMERCIAL_MODE.givingBack);
      setSessionPriceUsd('');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let photoPath = profile.photoPath;
      if (photo) {
        if (!profile.slug) throw new Error('A public URL is required before a photo can be uploaded');
        photoPath = await uploadProfilePhoto(profile.slug, photo);
      }
      await updateOwnProfile({
        displayName,
        professionalIdentity,
        location,
        locationPublic,
        slug: slug.trim() || undefined,
        public: published,
        photoPath,
        education: parseEducation(education),
        qualifications: parseCredentials(qualifications),
        certifications: parseCredentials(certifications),
        jobStatus,
        careerAspirations,
        skillsDeveloping: csv(skillsDeveloping),
        skillsDemonstrated: csv(skillsDemonstrated),
        expertise,
        areasOfExpertise: csv(areas),
        experience: parseExperience(experience),
        professionalGoals,
        mentoringInterests,
        ...(role === 'mentor' && mentorApproved
          ? {
              mentorType,
              commercialMode,
              servicesDescription,
              sessionPriceUsd:
                commercialMode === COMMERCIAL_MODE.givingBack
                  ? null
                  : sessionPriceUsd.trim()
                    ? Number(sessionPriceUsd)
                    : null,
              sessionDurationMinutes: sessionDurationMinutes.trim()
                ? Number(sessionDurationMinutes)
                : null,
              offersVideoSessions,
              messagingIncluded,
              acceptsNewLearners,
            }
          : {}),
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => void onSubmit(event)}>
        <Stack gap={16}>
          <Text variant="h2">Edit public profile</Text>
          <Text variant="small">
            Only the fields you publish appear on the public page. Email and your account id
            stay off that page.
          </Text>
          <Input label="Name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          <Input
            label="Professional identity"
            value={professionalIdentity}
            onChange={(event) => setProfessionalIdentity(event.target.value)}
            hint="A short headline, such as Timber framing apprentice."
          />
          <Input
            label="Location (optional)"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <Checkbox
            checked={locationPublic}
            onChange={(event) => setLocationPublic(event.target.checked)}
            label="Show location on the public profile"
          />
          <Input
            label="Public URL"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            hint={`/${role === 'mentor' ? 'mentors' : 'learners'}/your-name`}
          />
          <FileField
            label="Photo"
            accept="image/jpeg,image/png,image/webp"
            fileName={photo?.name}
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
          <TextArea
            label="Education"
            value={education}
            onChange={(event) => setEducation(event.target.value)}
            hint="One per line: credential | institution | year"
          />
          <TextArea
            label="Qualifications"
            value={qualifications}
            onChange={(event) => setQualifications(event.target.value)}
            hint="One per line: title | issuer | year"
          />
          <TextArea
            label="Certifications"
            value={certifications}
            onChange={(event) => setCertifications(event.target.value)}
            hint="One per line: title | issuer | year"
          />
          {role === 'learner' ? (
            <>
              <TextArea
                label="Current professional status"
                value={jobStatus}
                onChange={(event) => setJobStatus(event.target.value)}
              />
              <TextArea
                label="Career aspirations"
                value={careerAspirations}
                onChange={(event) => setCareerAspirations(event.target.value)}
              />
              <Input
                label="Skills being developed"
                value={skillsDeveloping}
                onChange={(event) => setSkillsDeveloping(event.target.value)}
                hint="Comma-separated."
              />
              <Input
                label="Skills demonstrated"
                value={skillsDemonstrated}
                onChange={(event) => setSkillsDemonstrated(event.target.value)}
                hint="Completed work also adds skills here automatically."
              />
            </>
          ) : (
            <>
              <Input
                label="Areas of expertise"
                value={areas || expertise}
                onChange={(event) => setAreas(event.target.value)}
                hint="Comma-separated."
              />
              <TextArea
                label="Professional experience"
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                hint="One per line: title | organization | year | summary"
              />
              <TextArea
                label="Professional goals / interests"
                value={professionalGoals}
                onChange={(event) => setProfessionalGoals(event.target.value)}
              />
              <TextArea
                label="Mentoring interests"
                value={mentoringInterests}
                onChange={(event) => setMentoringInterests(event.target.value)}
              />
              {mentorApproved ? (
                <Stack gap={16}>
                  <Text variant="h3">Mentor offering</Text>
                  <Text variant="small">
                    Choose how you mentor on ApprentorBay. These settings appear on your public
                    profile after you save.
                  </Text>
                  <Stack gap={12}>
                    <Text variant="small">Mentor type</Text>
                    {(Object.values(MENTOR_TYPE) as MentorType[]).map((type) => (
                      <label key={type} className="flex cursor-pointer gap-3">
                        <input
                          type="radio"
                          name="mentorType"
                          checked={mentorType === type}
                          onChange={() => onMentorTypeChange(type)}
                        />
                        <Stack gap={4}>
                          <Text>{MENTOR_TYPE_LABEL[type]}</Text>
                          <Text variant="small">{MENTOR_TYPE_DESCRIPTION[type]}</Text>
                        </Stack>
                      </label>
                    ))}
                  </Stack>
                  <Stack gap={12}>
                    <Text variant="small">Commercial mode</Text>
                    {allowedCommercialModes.map((mode) => (
                      <label key={mode} className="flex cursor-pointer gap-3">
                        <input
                          type="radio"
                          name="commercialMode"
                          checked={commercialMode === mode}
                          onChange={() => {
                            setCommercialMode(mode);
                            if (mode === COMMERCIAL_MODE.givingBack) setSessionPriceUsd('');
                          }}
                        />
                        <Stack gap={4}>
                          <Text>{COMMERCIAL_MODE_LABEL[mode]}</Text>
                          <Text variant="small">{COMMERCIAL_MODE_DESCRIPTION[mode]}</Text>
                        </Stack>
                      </label>
                    ))}
                  </Stack>
                  <TextArea
                    label="Services description"
                    value={servicesDescription}
                    onChange={(event) => setServicesDescription(event.target.value)}
                    hint="A short summary of what learners can expect from working with you."
                  />
                  {commercialMode !== COMMERCIAL_MODE.givingBack ? (
                    <>
                      <Input
                        label="Session price (USD)"
                        type="number"
                        min="1"
                        step="1"
                        value={sessionPriceUsd}
                        onChange={(event) => setSessionPriceUsd(event.target.value)}
                        hint="Displayed on your public profile. Payment collection is not handled in-app yet."
                      />
                      <Input
                        label="Session duration (minutes, optional)"
                        type="number"
                        min="15"
                        max="180"
                        step="15"
                        value={sessionDurationMinutes}
                        onChange={(event) => setSessionDurationMinutes(event.target.value)}
                      />
                    </>
                  ) : null}
                  <Checkbox
                    checked={offersVideoSessions}
                    onChange={(event) => setOffersVideoSessions(event.target.checked)}
                    label="I offer video sessions"
                  />
                  <Checkbox
                    checked={messagingIncluded}
                    onChange={(event) => setMessagingIncluded(event.target.checked)}
                    label="Messaging is included in my mentorship"
                  />
                  <Checkbox
                    checked={acceptsNewLearners}
                    onChange={(event) => setAcceptsNewLearners(event.target.checked)}
                    label="I am accepting new learners"
                  />
                </Stack>
              ) : (
                <Text variant="small">
                  After participation is approved, you can choose your mentor type and commercial
                  mode here.
                </Text>
              )}
            </>
          )}
          <Checkbox
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            label="Publish this profile"
          />
          {error ? <Text variant="danger">{error}</Text> : null}
          {saved ? <Text variant="small">Saved. Public visitors see only the published projection.</Text> : null}
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
          {role === 'mentor' ? (
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={() => {
                setBusy(true);
                void submitMentorVerification()
                  .then(() => {
                    setSaved(true);
                    setError(null);
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : 'Could not submit verification');
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Submit for verification
            </Button>
          ) : null}
        </Stack>
      </form>
    </Card>
  );
}

async function uploadProfilePhoto(slug: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Photo storage is not available');
  const fileId = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const storagePath = profilePhotoStoragePath(slug, fileId);
  await uploadBytes(ref(storage, storagePath), file, {
    contentType: file.type || 'image/jpeg',
  });
  await getDownloadURL(ref(storage, storagePath));
  return storagePath;
}

function csv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function linesFromEducation(rows: EducationEntry[]): string {
  return rows.map((item) => [item.credential, item.institution, item.year].join(' | ')).join('\n');
}

function linesFromCredentials(rows: CredentialEntry[]): string {
  return rows.map((item) => [item.title, item.issuer, item.year].join(' | ')).join('\n');
}

function linesFromExperience(rows: ExperienceEntry[]): string {
  return rows
    .map((item) => [item.title, item.organization, item.year, item.summary].join(' | '))
    .join('\n');
}

function parseEducation(text: string): EducationEntry[] {
  return text
    .split('\n')
    .map((line, index) => {
      const [credential, institution, year] = line.split('|').map((part) => part.trim());
      if (!credential && !institution) return null;
      return { id: `edu-${index}`, credential: credential || '', institution: institution || '', year: year || '' };
    })
    .filter((item): item is EducationEntry => item != null);
}

function parseCredentials(text: string): CredentialEntry[] {
  return text
    .split('\n')
    .map((line, index) => {
      const [title, issuer, year] = line.split('|').map((part) => part.trim());
      if (!title) return null;
      return { id: `cred-${index}`, title, issuer: issuer || '', year: year || '' };
    })
    .filter((item): item is CredentialEntry => item != null);
}

function parseExperience(text: string): ExperienceEntry[] {
  return text
    .split('\n')
    .map((line, index) => {
      const [title, organization, year, summary] = line.split('|').map((part) => part.trim());
      if (!title && !organization) return null;
      return {
        id: `exp-${index}`,
        title: title || '',
        organization: organization || '',
        year: year || '',
        summary: summary || '',
      };
    })
    .filter((item): item is ExperienceEntry => item != null);
}
