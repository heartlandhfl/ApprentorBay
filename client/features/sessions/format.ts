import type { MentorshipSession } from '@apprentorbay/shared';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatSessionDate(iso: string): string {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) return '—';
  return dateFormatter.format(new Date(value));
}

export function formatSessionTime(iso: string): string {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) return '—';
  return timeFormatter.format(new Date(value));
}

export function formatSessionDateTime(iso: string): string {
  return `${formatSessionDate(iso)} at ${formatSessionTime(iso)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

export function sessionStatusTone(
  status: MentorshipSession['status'],
): 'neutral' | 'accent' | 'success' | 'danger' {
  switch (status) {
    case 'scheduled':
      return 'accent';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeToIso(value: string): string | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export const SESSION_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180] as const;
