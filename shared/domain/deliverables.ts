import { DELIVERABLE_STATUS, type DeliverableStatus } from './statuses.js';

export interface Deliverable {
  id: string;
  title: string;
  description: string;
  /** What evidence will prove the deliverable. Older docs may omit this. */
  expectedEvidence: string;
  finalEvidenceUrl: string;
  status: DeliverableStatus;
}

/** Written onto both public profiles when a contract completes (server-side). */
export interface DeliverableRef {
  id: string;
  contractId: string;
  title: string;
  description: string;
}

export function isCompletedDeliverable(
  deliverable: Pick<Deliverable, 'status'>,
): boolean {
  return deliverable.status === DELIVERABLE_STATUS.completed;
}
