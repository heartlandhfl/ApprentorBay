import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';

type PageProps = {
  children: ReactNode;
};

export function Page({ children }: PageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-16">{children}</main>
      <Footer />
    </div>
  );
}
