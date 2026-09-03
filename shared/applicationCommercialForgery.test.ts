import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPLICATION_STATUS,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  REQUEST_TYPE,
  VERIFICATION_STATUS,
  applicationCommercialFieldsFromSnapshot,
  buildMentorshipCommercialSnapshot,
  emptyMentorProfile,
  normalizeApplicationCommercialFields,
  normalizeMentorProfile,
  relationshipCommercialFromMentorProfile,
} from './index.js';

const approvedMentorBase = {
  verificationStatus: VERIFICATION_STATUS.approved,
  mentorType: MENTOR_TYPE.accomplished,
  acceptsNewLearners: true,
  offersVideoSessions: true,
  public: true,
} as const;

describe('application commercial forgery resistance', () => {
  it('does not treat forged free_request application fields as paymentSatisfied at accept', () => {
    const paidMentor = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Alex Mentor'),
      ...approvedMentorBase,
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 7500,
      sessionDurationMinutes: 60,
    });

    const forgedApplication = {
      id: 'app-forged',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      message: 'Please mentor me',
      status: APPLICATION_STATUS.pending,
      createdAt: '2026-09-01T00:00:00.000Z',
      requestType: REQUEST_TYPE.freeRequest,
      commercialMode: COMMERCIAL_MODE.givingBack,
      baseSessionPriceUsd: null,
      sessionDurationMinutes: null,
    };

    const forgedSnapshot = normalizeApplicationCommercialFields(forgedApplication);
    assert.equal(forgedSnapshot.requestType, REQUEST_TYPE.freeRequest);
    assert.equal(forgedSnapshot.paymentSatisfied, true);

    const commercial = relationshipCommercialFromMentorProfile(paidMentor);
    assert.equal(commercial.requestType, REQUEST_TYPE.paidRequest);
    assert.equal(commercial.commercialMode, COMMERCIAL_MODE.professional);
    assert.equal(commercial.baseSessionPriceUsd, 7500);
    assert.equal(commercial.paymentRequired, true);
    assert.equal(commercial.paymentSatisfied, false);
  });

  it('derives relationship commercial from the mentor profile at accept time', () => {
    const paidSnapshot = buildMentorshipCommercialSnapshot({
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 12_000,
      sessionDurationMinutes: 60,
    });
    const application = {
      id: 'app-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      message: 'Please mentor me',
      status: APPLICATION_STATUS.pending,
      createdAt: '2026-09-01T00:00:00.000Z',
      ...applicationCommercialFieldsFromSnapshot(paidSnapshot),
    };
    const laterFreeMentor = normalizeMentorProfile({
      ...emptyMentorProfile('mentor-1', 'Alex'),
      ...approvedMentorBase,
      commercialMode: COMMERCIAL_MODE.givingBack,
    });

    assert.equal(normalizeApplicationCommercialFields(application).requestType, REQUEST_TYPE.paidRequest);
    assert.equal(
      relationshipCommercialFromMentorProfile(laterFreeMentor).requestType,
      REQUEST_TYPE.freeRequest,
    );
    assert.equal(relationshipCommercialFromMentorProfile(laterFreeMentor).paymentSatisfied, true);
  });
});
