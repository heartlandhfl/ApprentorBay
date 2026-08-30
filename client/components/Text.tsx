import type { ElementType, ReactNode } from 'react';

const variants = {
  display: 'font-display text-display text-ink tracking-tight',
  h1: 'font-display text-h1 text-ink tracking-tight',
  h2: 'font-display text-h2 text-ink',
  h3: 'font-sans text-h3 font-medium text-ink',
  body: 'font-sans text-body text-ink',
  muted: 'font-sans text-body text-ink-muted',
  small: 'font-sans text-small text-ink-muted',
  caption: 'font-sans text-caption uppercase tracking-[0.12em] text-ink-muted',
  danger: 'font-sans text-small text-danger',
} as const;

const defaultTags = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  body: 'p',
  muted: 'p',
  small: 'p',
  caption: 'p',
  danger: 'p',
} as const;

export type TextVariant = keyof typeof variants;

type TextProps = {
  variant?: TextVariant;
  as?: ElementType;
  children: ReactNode;
};

export function Text({ variant = 'body', as, children }: TextProps) {
  const Tag = as ?? defaultTags[variant];
  return <Tag className={variants[variant]}>{children}</Tag>;
}
