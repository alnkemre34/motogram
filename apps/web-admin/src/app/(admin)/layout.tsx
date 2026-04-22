// Spec 5.4 - Admin (authenticated) layout guard'i.
// Session yoksa login'e yonlendir; ADMIN/MODERATOR degilse 403 goster.
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/sidebar';
import { authOptions } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    redirect('/login');
  }
  if (session.role !== 'ADMIN' && session.role !== 'MODERATOR') {
    redirect('/login?error=forbidden');
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
