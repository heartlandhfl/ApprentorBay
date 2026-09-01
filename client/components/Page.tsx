import type { ReactNode } from 'react';
import { Header } from './Header';

type PageProps = {
  children: ReactNode;
};

export function Page({ children }: PageProps) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-16">{children}</main>
    </div>
  );
}
