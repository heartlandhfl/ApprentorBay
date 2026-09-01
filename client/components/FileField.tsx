import type { InputHTMLAttributes } from 'react';
import { Stack } from './Stack';
import { Text } from './Text';

type FileFieldProps = {
  label: string;
  hint?: string;
  fileName?: string | null;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'>;

export function FileField({ label, hint, fileName, id, ...rest }: FileFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <Stack gap={8}>
      <Text variant="small" as="span">
        {label}
      </Text>
      {hint ? <Text variant="small">{hint}</Text> : null}
      <label
        htmlFor={inputId}
        className="flex min-h-12 w-full cursor-pointer items-center rounded-sm border border-dashed border-line bg-paper px-3 py-3"
      >
        <input id={inputId} type="file" className="sr-only" {...rest} />
        <Text variant="small" as="span">
          {fileName || 'Choose a file'}
        </Text>
      </label>
    </Stack>
  );
}
