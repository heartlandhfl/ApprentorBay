import { NOTIFICATION_STATUS, type NotificationStatus } from './statuses.js';
import type { IsoDateString } from './users.js';

/**
 * In-app notification. Reserved collection: `notifications`.
 * No current write path. Types exist so future work uses one shape.
 */
export const NOTIFICATION_TYPE = {
  applicationReceived: 'application_received',
  applicationAccepted: 'application_accepted',
  applicationDeclined: 'application_declined',
  journeyWaiting: 'journey_waiting',
  message: 'message',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  createdAt: IsoDateString;
  status: NotificationStatus;
}

export function isUnreadNotification(
  notification: Pick<Notification, 'status'>,
): boolean {
  return notification.status === NOTIFICATION_STATUS.unread;
}
