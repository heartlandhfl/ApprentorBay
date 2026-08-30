import type { ReactNode } from 'react';

const paddings = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const;

type CardProps = {
  padding?: keyof typeof paddings;
  children: ReactNode;
};

export function Card({ padding = 'md', children }: CardProps) {
  return (
    <section className={`rounded-sm border border-line bg-paper-raised ${paddings[padding]}`}>
      {children}
    </section>
  );
}
