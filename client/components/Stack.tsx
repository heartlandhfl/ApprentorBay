import type { ReactNode } from 'react';

const gaps = {
  4: 'gap-1',
  8: 'gap-2',
  12: 'gap-3',
  16: 'gap-4',
  24: 'gap-6',
  32: 'gap-8',
  48: 'gap-12',
} as const;

type StackProps = {
  gap?: keyof typeof gaps;
  children: ReactNode;
};

export function Stack({ gap = 16, children }: StackProps) {
  return <div className={`flex flex-col ${gaps[gap]}`}>{children}</div>;
}

export function Cluster({ gap = 16, children }: StackProps) {
  return <div className={`flex flex-wrap items-center ${gaps[gap]}`}>{children}</div>;
}
