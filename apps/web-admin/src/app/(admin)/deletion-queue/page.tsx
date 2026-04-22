// Spec 7.2.1 - Silme Kuyrugu izleme sayfasi.
// Dashboard snapshot'indan "pendingDeletion" sayisini gosterir. Detay listesi
// AccountDeletion modeli uzerinden /admin/deletion-queue endpoint'i ile v1.1'de gelecek.
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DeletionQueuePage() {
  const session = await getServerSession(authOptions);
  const snapshot = await adminApi.dashboard({ accessToken: session?.accessToken }).catch(() => null);
  const pending = snapshot?.users.pendingDeletion ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Silme Kuyrugu</h1>
        <p className="text-sm text-textMuted">
          Spec 7.2.1 - Soft delete + BullMQ DELETE_USER_DATA 30 gun sonra hard delete uygular.
          Kullanici tekrar giris yaparsa kuyruk otomatik iptal edilir.
        </p>
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-textMuted">Silme Bekleyen Kullanici</div>
          <div className="mt-2 text-4xl font-semibold tabular-nums text-accent">{pending}</div>
        </div>
        <div className="max-w-md text-right text-xs text-textMuted">
          Her kayit benzersiz bir <code>DeletionJob.jobId</code> ile takip edilir. Login sirasinda
          bu job iptal edilerek hesap geri yuklenir.
        </div>
      </div>

      <div className="card text-sm">
        <h2 className="mb-2 font-medium">Islem Akisi</h2>
        <ol className="ml-4 list-decimal space-y-1 text-textMuted">
          <li>Kullanici <code>/account/delete</code> endpoint'ini cagirir</li>
          <li>
            <code>AccountService.requestDeletion</code>: <code>deletedAt = now()</code> ve BullMQ
            job'i 30 gun delayli olarak kuyruga eklenir (<code>jobId</code> saklanir)
          </li>
          <li>
            30 gun icinde login olursa <code>AUTH_LOGIN_EVENT</code> listener
            <code>cancelDeletionOnLogin</code>'u tetikler ve job iptal edilir
          </li>
          <li>Aksi halde DELETE_USER_DATA worker'i tum PII'yi hard-delete eder</li>
          <li>RetentionWorker cron'u (daily) bu kuyrukta kalan artiklari yakalar</li>
        </ol>
      </div>
    </div>
  );
}
