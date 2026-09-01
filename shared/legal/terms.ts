/**
 * ApprentorBay Terms of Use — the only file to edit when legal copy or
 * versioning changes.
 *
 * TERMS_CONFIG.version is what onboarding records store as `termsVersion`.
 * Bump it whenever the binding text changes. Logged-in users whose stored
 * version does not match are asked to accept again.
 *
 * TERMS_CONFIG.effectiveDate is the calendar day these Terms become binding
 * (UTC). Do not describe them as already in force before that day.
 */
export const TERMS_CONFIG = {
  version: '2026-09-10',
  /** YYYY-MM-DD (UTC). These Terms take effect on this date. */
  effectiveDate: '2026-09-10',
  title: 'ApprentorBay Terms of Use',
} as const;

export const TERMS_VERSION = TERMS_CONFIG.version;
export const TERMS_EFFECTIVE_DATE = TERMS_CONFIG.effectiveDate;
export const TERMS_TITLE = TERMS_CONFIG.title;

/** Exact confirmation shown at signup and on a Terms version bump. */
export const TERMS_ACCEPTANCE_LABEL =
  'I confirm that I am legally eligible to use ApprentorBay and agree to the Terms of Use.';

export const TERMS_SUMMARY =
  'ApprentorBay is a mentorship and apprenticeship service. Creating an account requires an explicit confirmation that you are legally eligible to use the service and that you agree to these Terms. Visiting this page, or reading a summary, is not acceptance.';

export type TermsSection = {
  heading: string;
  body: string;
};

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. Effective date and version',
    body: `These Terms of Use are version ${TERMS_VERSION}. They take effect on 10 September 2026 (the Effective Date). Until that date they are published so you can read them before you create an account; they are not yet in force. After the Effective Date they govern use of ApprentorBay. The version identifier stored on your account is ${TERMS_VERSION}.`,
  },
  {
    heading: '2. Eligibility and acceptance',
    body: `You must be legally eligible to use an online mentorship service in your jurisdiction. You accept these Terms only by checking the confirmation “${TERMS_ACCEPTANCE_LABEL}” before an account is created, or when you are asked to accept a new version. Opening the Terms page, using a public page, or reading a summary is not acceptance. ApprentorBay records that confirmation as termsAccepted, the current termsVersion, and termsAcceptedAt.`,
  },
  {
    heading: '3. The service',
    body: 'ApprentorBay is a place for learners and mentors to form a pairing, write a learning contract, submit evidence against milestones, and publish a deliverable on public profiles. The service is not a marketplace, a social feed, an employer, or a school. Public mentor listings show only approved mentors. Approval is not a background check.',
  },
  {
    heading: '4. Accounts and roles',
    body: 'You choose one role at signup: learner or mentor. The role cannot be changed by you later. Mentors are not approved for public listing until an administrator reviews them. You are responsible for the accuracy of your profile and for keeping your sign-in credentials to yourself. Administrators may restrict, suspend, or terminate an account.',
  },
  {
    heading: '5. Pairings, contracts, and deliverables',
    body: 'A pairing is between two people. Messages in a relationship are for those two people and authorized administrators. A completed deliverable may appear on both public profiles when the learner publishes a showcase. You grant ApprentorBay the right to display work you choose to publish. Private evidence files stay in the pairing unless you include them in a published showcase.',
  },
  {
    heading: '6. Conduct',
    body: 'Do not harass, impersonate, or use ApprentorBay to run a marketplace, a feed, or a scam. Do not upload work you do not have the right to share. We may hide a public profile and restrict or suspend an account when conduct rules are broken.',
  },
  {
    heading: '7. No professional advice',
    body: 'Nothing on ApprentorBay is legal, medical, financial, or employment advice. Mentors share experience. Learners do the work. Outcomes, jobs, credentials, and licenses are not guaranteed. A learning contract is a record of agreed work on this service, not an employment contract.',
  },
  {
    heading: '8. Changes',
    body: 'When these Terms change, TERMS_CONFIG.version in the application configuration is bumped. You will be asked to accept the new version with the same confirmation before you can keep using a signed-in session. A new Effective Date, if any, will be stated in section 1.',
  },
];
