// Spec 5.4 + 9.1 - Motogram Admin Paneli root layout.
// Tailwind global stilleri + font + NextAuth/ReactQuery provider sarmalanir.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Motogram Admin',
  description: 'Motogram yonetim paneli (Spec 5.4)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
