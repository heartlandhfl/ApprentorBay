import type { ReactNode } from 'react';

const tones = {
  neutral: 'bg-paper text-ink-muted border-line',
  accent: 'bg-accent-subtle text-accent border-accent-subtle',
  success: 'bg-success-subtle text-success border-success-subtle',
  danger: 'bg-danger-subtle text-danger border-danger-subtle',
} as const;

type BadgeProps = {
  tone?: keyof typeof tones;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-caption uppercase tracking-[0.12em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
