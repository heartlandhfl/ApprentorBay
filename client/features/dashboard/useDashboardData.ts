import { useEffect, useMemo, useState } from 'react';
import {
  USER_ROLE,
  type LearnerProfile,
  type LearningContract,
  type MentorProfile,
  type MentorshipApplication,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';
import { watchContractsForRelationships } from '../learning-contracts';
import {
  watchAccountRelationships,
  watchLearnerApplications,
  watchPendingApplications,
} from '../mentorship';
import { watchLearnerProfile, watchMentorProfile } from '../profiles';

export function useDashboardData(account: User | null) {
  const [applications, setApplications] = useState<MentorshipApplication[] | null>(null);
  const [relationships, setRelationships] = useState<MentorshipRelationship[] | null>(null);
  const [contracts, setContracts] = useState<LearningContract[]>([]);
  const [learner, setLearner] = useState<LearnerProfile | null>(null);
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return undefined;
    setError(null);

    const unsubs: Array<() => void> = [
      watchAccountRelationships(account, setRelationships, (err) => setError(err.message)),
    ];

    if (account.role === USER_ROLE.learner) {
      unsubs.push(
        watchLearnerApplications(account.uid, setApplications, (err) => setError(err.message)),
        watchLearnerProfile(account.uid, setLearner, (err) => setError(err.message)),
      );
    } else if (account.role === USER_ROLE.mentor) {
      unsubs.push(
        watchPendingApplications(account.uid, setApplications, (err) => setError(err.message)),
        watchMentorProfile(account.uid, setMentor, (err) => setError(err.message)),
      );
    } else {
      setApplications([]);
    }

    return () => unsubs.forEach((unsub) => unsub());
  }, [account]);

  const relationshipIds = useMemo(
    () => (relationships ?? []).map((row) => row.id).join('|'),
    [relationships],
  );

  useEffect(() => {
    if (!account || relationships === null) return undefined;
    return watchContractsForRelationships(
      relationships.map((row) => row.id),
      setContracts,
      (err) => setError(err.message),
    );
  }, [account, relationshipIds, relationships]);

  return {
    applications: applications ?? [],
    relationships: relationships ?? [],
    contracts,
    learner,
    mentor,
    error,
    ready: applications !== null && relationships !== null,
  };
}
