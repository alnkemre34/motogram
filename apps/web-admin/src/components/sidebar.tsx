'use client';

// Spec 5.4 - Admin paneli sol kenar menusu. Tum ana sayfalar buradan erisilir.
import clsx from 'clsx';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileText,
  FlagTriangleRight,
  LayoutDashboard,
  LogOut,
  MapPinned,
  ScrollText,
  Trophy,
  Users,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports', label: 'Raporlar', icon: AlertTriangle },
  { href: '/users', label: 'Kullanicilar', icon: Users },
  { href: '/live-map', label: 'Canli Harita', icon: MapPinned },
  { href: '/audit-logs', label: 'Audit Log', icon: ScrollText },
  { href: '/feature-flags', label: 'Feature Flag', icon: FlagTriangleRight },
  { href: '/ab-tests', label: 'A/B Testler', icon: BarChart3 },
  { href: '/quests', label: 'Quest / Rozet', icon: Trophy },
  { href: '/deletion-queue', label: 'Silme Kuyrugu', icon: Activity },
  { href: '/docs', label: 'Dokumantasyon', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <div className="text-lg font-semibold text-accent">Motogram</div>
        <div className="text-xs text-textMuted">Admin v1.0.0</div>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-surfaceHover text-accent'
                  : 'text-textMuted hover:bg-surfaceHover hover:text-text',
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-3 text-xs text-textMuted">
          {session?.user?.name ?? 'Guest'} <span className="badge ml-1">{session?.role}</span>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textMuted hover:bg-surfaceHover"
        >
          <LogOut size={16} /> Cikis
        </button>
      </div>
    </aside>
  );
}
