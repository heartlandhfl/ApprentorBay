import type { ReactNode } from 'react';

const columns = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
} as const;

type GridProps = {
  cols?: keyof typeof columns;
  children: ReactNode;
};

export function Grid({ cols = 3, children }: GridProps) {
  return <div className={`grid grid-cols-1 gap-6 ${columns[cols]}`}>{children}</div>;
}
