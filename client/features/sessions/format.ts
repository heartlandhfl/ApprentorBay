import {
  SESSION_SCHEDULE_DURATION_OPTIONS,
  findSchedulingConflict,
  type MentorshipSession,
} from '@apprentorbay/shared';

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
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours} hr ${remainder} min`;
}

export function formatDurationLabel(minutes: number): string {
  return `${minutes} minutes`;
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

export function localTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatTimezoneCaption(): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(new Date());
  const shortName = parts.find((part) => part.type === 'timeZoneName')?.value;
  return shortName
    ? `Times shown in your local timezone (${shortName}).`
    : `Times shown in your local timezone (${localTimezoneName()}).`;
}

export function toLocalDateInputValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalTimeInputValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineLocalDateAndTime(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const local = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hour ||
    local.getMinutes() !== minute
  ) {
    return null;
  }
  return local.toISOString();
}

export function defaultScheduleDate(): string {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 60);
  next.setSeconds(0, 0);
  return toLocalDateInputValue(next);
}

export function defaultScheduleTime(): string {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 60);
  next.setSeconds(0, 0);
  return toLocalTimeInputValue(next);
}

export function minScheduleDate(): string {
  return toLocalDateInputValue(new Date());
}

export { SESSION_SCHEDULE_DURATION_OPTIONS, findSchedulingConflict };
