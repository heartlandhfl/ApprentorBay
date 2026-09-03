import { useEffect, useState, type FormEvent } from 'react';
import { SESSION_SCHEDULE, USER_ROLE, validateLocalScheduleFields, type UserRole } from '@apprentorbay/shared';
import { Button, Input, Modal, Stack, Text } from '../../components';
import { createMentorshipSession } from '../../lib/api';
import {
  SESSION_SCHEDULE_DURATION_OPTIONS,
  combineLocalDateAndTime,
  defaultScheduleDate,
  defaultScheduleTime,
  findSchedulingConflict,
  formatDurationLabel,
  formatTimezoneCaption,
  minScheduleDate,
} from './format';
import type { MentorshipSession } from '@apprentorbay/shared';

type ScheduleSessionModalProps = {
  open: boolean;
  relationshipId: string;
  accountRole: UserRole;
  existingSessions: MentorshipSession[];
  onClose: () => void;
  onScheduled: () => void;
};

function scheduleIntro(role: UserRole): string {
  if (role === USER_ROLE.mentor) {
    return 'Choose a time to meet with your learner.';
  }
  if (role === USER_ROLE.learner) {
    return 'Choose a time to meet with your mentor.';
  }
  return 'Choose a time for this mentorship session.';
}

export function ScheduleSessionModal({
  open,
  relationshipId,
  accountRole,
  existingSessions,
  onClose,
  onScheduled,
}: ScheduleSessionModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultScheduleDate);
  const [time, setTime] = useState(defaultScheduleTime);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDate(defaultScheduleDate());
    setTime(defaultScheduleTime());
    setDurationMinutes(60);
    setError(null);
  }, [open]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Session title is required');
      setBusy(false);
      return;
    }
    if (trimmedTitle.length > SESSION_SCHEDULE.maxTitleLength) {
      setError(`Session title must be at most ${SESSION_SCHEDULE.maxTitleLength} characters`);
      setBusy(false);
      return;
    }

    const fieldCheck = validateLocalScheduleFields({ date, time, durationMinutes });
    if (!fieldCheck.ok) {
      setError(fieldCheck.error);
      setBusy(false);
      return;
    }

    const scheduledStart = combineLocalDateAndTime(date, time);
    if (!scheduledStart) {
      setError('Choose a valid date and start time.');
      setBusy(false);
      return;
    }

    const scheduledEnd = new Date(
      Date.parse(scheduledStart) + durationMinutes * 60_000,
    ).toISOString();

    const conflict = findSchedulingConflict(scheduledStart, scheduledEnd, existingSessions);
    if (conflict) {
      setError('This time overlaps another scheduled session for this mentorship.');
      setBusy(false);
      return;
    }

    try {
      await createMentorshipSession({
        relationshipId,
        title: trimmedTitle,
        scheduledStart,
        scheduledEnd,
      });
      onScheduled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule the session');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Schedule a mentorship session"
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            Close
          </Button>
          <Button
            type="submit"
            form="schedule-session-form"
            loading={busy}
            className="w-full sm:w-auto"
          >
            Schedule session
          </Button>
        </div>
      }
    >
      <form id="schedule-session-form" onSubmit={(event) => void onSubmit(event)}>
        <Stack gap={16}>
          <Text variant="small">{scheduleIntro(accountRole)}</Text>
          <Text variant="caption">{formatTimezoneCaption()}</Text>

          <Input
            label="Session title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={SESSION_SCHEDULE.maxTitleLength}
            required
            placeholder="Weekly check-in"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date"
              type="date"
              value={date}
              min={minScheduleDate()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
            <Input
              label="Start time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
          </div>

          <Stack gap={8}>
            <Text variant="small" as="span">
              Duration
            </Text>
            <div className="grid gap-2 sm:grid-cols-3">
              {SESSION_SCHEDULE_DURATION_OPTIONS.map((minutes) => {
                const selected = durationMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDurationMinutes(minutes)}
                    className={`rounded-sm border px-4 py-3 text-left text-small transition-colors ${
                      selected
                        ? 'border-accent bg-accent-subtle text-accent'
                        : 'border-line bg-paper-raised text-ink hover:border-ink'
                    }`}
                  >
                    {formatDurationLabel(minutes)}
                  </button>
                );
              })}
            </div>
          </Stack>

          {error ? <Text variant="danger">{error}</Text> : null}
        </Stack>
      </form>
    </Modal>
  );
}
