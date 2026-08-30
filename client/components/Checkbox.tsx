import { Text } from './Text';

type CheckboxProps = {
  id?: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (event: { target: { checked: boolean } }) => void;
};

export function Checkbox({ id, label, hint, checked, onChange }: CheckboxProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-').slice(0, 48);

  return (
    <div className="flex flex-col gap-2">
      <button
        id={inputId}
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange({ target: { checked: !checked } })}
        className="flex w-full cursor-pointer items-start gap-3 rounded-sm text-left"
      >
        <span
          aria-hidden
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
            checked ? 'border-accent bg-accent text-paper-raised' : 'border-ink bg-paper-raised'
          }`}
        >
          {checked ? '✓' : ''}
        </span>
        <Text variant="small" as="span">
          {label}
        </Text>
      </button>
      {hint ? <Text variant="small">{hint}</Text> : null}
    </div>
  );
}
