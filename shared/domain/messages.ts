import type { IsoDateString } from './users.js';

export interface Message {
  id: string;
  relationshipId: string;
  senderId: string;
  text: string;
  createdAt: IsoDateString;
}

export const MESSAGE_TEXT = {
  minLength: 1,
  maxLength: 2000,
} as const;
