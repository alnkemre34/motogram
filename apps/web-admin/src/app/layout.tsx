// Spec 5.4 + 9.1 - Motogram Admin Paneli root layout.
// SessionProvider / React Query burada YOK: Next 15 varsayılan /404 prerender’ında
// next-auth SessionProvider ile "useRef of null" hatası oluşuyordu. Sağlayıcılar
// yalnızca (admin) ve login segment layout’larında.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Motogram Admin',
  description: 'Motogram yonetim paneli (Spec 5.4)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen bg-background font-sans text-text antialiased">{children}</body>
    </html>
  );
}
