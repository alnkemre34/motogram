// Spec 5.4 - Dashboard: aktif kullanici, parti, acil durum, vb. metrikler.
// Server Component: session token ile backend /admin/dashboard/snapshot cekilir.
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

import { MetricCard } from './metric-card';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  let snapshot: Awaited<ReturnType<typeof adminApi.dashboard>> | null = null;
  let errorMsg: string | null = null;
  try {
    snapshot = await adminApi.dashboard({ accessToken: session?.accessToken });
  } catch (err) {
    errorMsg = (err as Error).message;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-textMuted">
            Motogram sistem durumu — son guncelleme:{' '}
            {snapshot ? new Date(snapshot.timestamp).toLocaleString('tr-TR') : 'N/A'}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="card border-accentDanger/40 bg-accentDanger/10 text-sm text-accentDanger">
          Backend baglantisi basarisiz: {errorMsg}
        </div>
      )}

      {snapshot && (
        <>
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase text-textMuted">Kullanicilar</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <MetricCard label="Toplam" value={snapshot.users.total} />
              <MetricCard label="Son 24s Aktif" value={snapshot.users.active24h} />
              <MetricCard label="Banli" value={snapshot.users.banned} tone="danger" />
              <MetricCard
                label="Silme Bekleyen"
                value={snapshot.users.pendingDeletion}
                tone="warning"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase text-textMuted">Icerik (24s)</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <MetricCard label="Gonderi" value={snapshot.content.postsLast24h} />
              <MetricCard label="Hikaye" value={snapshot.content.storiesLast24h} />
              <MetricCard label="Mesaj" value={snapshot.content.messagesLast24h} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase text-textMuted">Guvenlik</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <MetricCard label="Acik Rapor" value={snapshot.safety.openReports} tone="warning" />
              <MetricCard
                label="Aktif SOS"
                value={snapshot.safety.emergencyAlertsOpen}
                tone="danger"
              />
              <MetricCard label="SOS Rate-Limit (24s)" value={snapshot.safety.rateLimitedSos24h} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase text-textMuted">Altyapi</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <MetricCard label="Aktif Parti" value={snapshot.infra.activeParties} />
              <MetricCard label="Aktif Surus" value={snapshot.infra.activeRideSessions} />
              <MetricCard label="Medya Islenen" value={snapshot.infra.mediaAssetsProcessing} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
