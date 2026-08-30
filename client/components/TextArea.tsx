import type { TextareaHTMLAttributes } from 'react';
import { Stack } from './Stack';
import { Text } from './Text';

type TextAreaProps = {
  label: string;
  hint?: string;
  error?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export function TextArea({
  label,
  hint,
  error,
  id,
  disabled,
  ...rest
}: TextAreaProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <Stack gap={8}>
      <label htmlFor={inputId}>
        <Text variant="small" as="span">
          {label}
        </Text>
      </label>
      <textarea
        id={inputId}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        rows={4}
        className={`w-full rounded-sm border bg-paper-raised px-3 py-2 text-body text-ink transition-colors duration-150 placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-paper disabled:opacity-60 ${
          error
            ? 'border-danger focus:border-danger'
            : 'border-line hover:border-ink focus:border-accent'
        }`}
        {...rest}
      />
      {error ? (
        <Text variant="danger" as="p">
          <span id={`${inputId}-error`}>{error}</span>
        </Text>
      ) : hint ? (
        <Text variant="small" as="p">
          <span id={`${inputId}-hint`}>{hint}</span>
        </Text>
      ) : null}
    </Stack>
  );
}
