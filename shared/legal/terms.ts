/**
 * ApprentorBay Terms of Use — the only file to edit when legal copy changes.
 *
 * Bump TERMS_VERSION whenever the binding text changes. Logged-in users
 * whose stored termsVersion does not match are blocked until they re-accept.
 */
export const TERMS_VERSION = '2026-08-31';

export const TERMS_TITLE = 'ApprentorBay Terms of Use';

export const TERMS_SUMMARY =
  'ApprentorBay is a mentorship harbor. By creating an account you agree to use the service in good faith, keep your pairing private, and accept that learning contracts and public deliverables are records of work — not employment, not a guarantee of outcomes, and not legal advice.';

export type TermsSection = {
  heading: string;
  body: string;
};

/** Placeholder body. Replace these sections with the final counsel-approved text. */
export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. The harbor',
    body: 'ApprentorBay is a place for learners and mentors to form a pairing, write a learning contract, and publish a deliverable. These Terms govern your use of the service. Placeholder text — replace this section with the final Terms of Use.',
  },
  {
    heading: '2. Accounts and roles',
    body: 'You choose one role at signup: learner or mentor. Mentors are not verified until an administrator approves them. You are responsible for the accuracy of your profile and for keeping your sign-in credentials to yourself. Placeholder text — replace this section with the final Terms of Use.',
  },
  {
    heading: '3. Pairings, contracts, and deliverables',
    body: 'A pairing is between two people. Messages in a relationship are for those two people. A completed deliverable may appear on both public profiles. You grant ApprentorBay the right to display work you publish on the service. Placeholder text — replace this section with the final Terms of Use.',
  },
  {
    heading: '4. Conduct',
    body: 'Do not harass, impersonate, or use the harbor to run a marketplace, a feed, or a scam. We may suspend an account (active: false) and hide its public profile. Placeholder text — replace this section with the final Terms of Use.',
  },
  {
    heading: '5. No professional advice',
    body: 'Nothing on ApprentorBay is legal, medical, financial, or employment advice. Mentors share experience. Learners do the work. Outcomes are not guaranteed. Placeholder text — replace this section with the final Terms of Use.',
  },
  {
    heading: '6. Changes',
    body: 'When these Terms change, TERMS_VERSION in this file is bumped. You will be asked to accept the new version before you can keep using a signed-in session. Placeholder text — replace this section with the final Terms of Use.',
  },
];
