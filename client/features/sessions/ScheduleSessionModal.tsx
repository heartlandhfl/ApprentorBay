import { useState, type FormEvent } from 'react';
import { SESSION_SCHEDULE } from '@apprentorbay/shared';
import { Button, Input, Modal, Stack, Text } from '../../components';
import { createMentorshipSession } from '../../lib/api';
import {
  SESSION_DURATION_OPTIONS,
  localDateTimeToIso,
  toLocalDateTimeInputValue,
} from './format';

type ScheduleSessionModalProps = {
  open: boolean;
  relationshipId: string;
  onClose: () => void;
  onScheduled: () => void;
};

function defaultStartValue(): string {
  const next = new Date();
  next.setMinutes(next.getMinutes() + 60);
  next.setSeconds(0, 0);
  return toLocalDateTimeInputValue(next);
}

export function ScheduleSessionModal({
  open,
  relationshipId,
  onClose,
  onScheduled,
}: ScheduleSessionModalProps) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStartValue);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const scheduledStart = localDateTimeToIso(startsAt);
    if (!scheduledStart) {
      setError('Choose a valid start date and time.');
      setBusy(false);
      return;
    }

    const scheduledEnd = new Date(
      Date.parse(scheduledStart) + durationMinutes * 60_000,
    ).toISOString();

    try {
      await createMentorshipSession({
        relationshipId,
        title,
        scheduledStart,
        scheduledEnd,
      });
      setTitle('');
      setStartsAt(defaultStartValue());
      setDurationMinutes(60);
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
      title="Schedule a session"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="schedule-session-form" loading={busy}>
            Schedule session
          </Button>
        </div>
      }
    >
      <form id="schedule-session-form" onSubmit={(event) => void onSubmit(event)}>
        <Stack gap={16}>
          <Text variant="small">
            Plan a one-to-one video call with your mentorship partner. Sessions must be between{' '}
            {SESSION_SCHEDULE.minDurationMinutes} and {SESSION_SCHEDULE.maxDurationMinutes} minutes.
          </Text>
          <Input
            label="Session title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={SESSION_SCHEDULE.maxTitleLength}
            required
            placeholder="Weekly check-in"
          />
          <Input
            label="Start date and time"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
          <Stack gap={8}>
            <label htmlFor="session-duration">
              <Text variant="small" as="span">
                Duration
              </Text>
            </label>
            <select
              id="session-duration"
              className="h-10 w-full rounded-sm border border-line bg-paper-raised px-3 text-body text-ink"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              {SESSION_DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </Stack>
          {error ? <Text variant="danger">{error}</Text> : null}
        </Stack>
      </form>
    </Modal>
  );
}
