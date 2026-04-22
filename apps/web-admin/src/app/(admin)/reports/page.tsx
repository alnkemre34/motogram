// Spec 5.4 - Rapor kuyrugu (PENDING/REVIEWING/RESOLVED/DISMISSED).
// Listeden inceleme + ban akisi bu sayfadan erisilir.
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

import { ReportsTable } from './reports-table';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  const reports = await adminApi
    .listReports(
      { status: searchParams.status as never, limit: 50 },
      { accessToken: session?.accessToken },
    )
    .catch(() => []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Raporlar</h1>
        <p className="text-sm text-textMuted">
          Spec 7.2.2 - Kullanici, gonderi, yorum, mesaj ve etkinlik sikayetleri.
        </p>
      </div>

      <nav className="flex gap-2 text-sm">
        {['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'].map((s) => (
          <a
            key={s}
            href={`/reports?status=${s}`}
            className={
              searchParams.status === s
                ? 'rounded-lg bg-accent px-3 py-1 text-background'
                : 'rounded-lg border border-border bg-surface px-3 py-1 text-textMuted hover:bg-surfaceHover'
            }
          >
            {s}
          </a>
        ))}
        <a
          href="/reports"
          className={
            !searchParams.status
              ? 'rounded-lg bg-accent px-3 py-1 text-background'
              : 'rounded-lg border border-border bg-surface px-3 py-1 text-textMuted hover:bg-surfaceHover'
          }
        >
          Tumu
        </a>
      </nav>

      <ReportsTable reports={reports} />
    </div>
  );
}
