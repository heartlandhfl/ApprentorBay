import type { InputHTMLAttributes } from 'react';
import { Text } from './Text';

type CheckboxProps = {
  label: string;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'>;

export function Checkbox({ label, hint, id, checked, ...rest }: CheckboxProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-').slice(0, 48);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          className="mt-1 h-5 w-5 shrink-0 accent-accent"
          {...rest}
        />
        <Text variant="small" as="span">
          {label}
        </Text>
      </label>
      {hint ? <Text variant="small">{hint}</Text> : null}
    </div>
  );
}
