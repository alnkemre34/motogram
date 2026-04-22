// Spec 5.4 - Admin islem kaydi (audit log) listesi.
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { action?: string; actorUserId?: string };
}) {
  const session = await getServerSession(authOptions);
  const logs = await adminApi
    .listAuditLogs(
      {
        action: searchParams.action,
        actorUserId: searchParams.actorUserId,
        limit: 100,
      },
      { accessToken: session?.accessToken },
    )
    .catch(() => []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Islem Kayitlari</h1>
        <p className="text-sm text-textMuted">
          Admin paneli uzerinde gerceklesen tum mutasyonel islemler. (Immutable)
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="action"
          defaultValue={searchParams.action ?? ''}
          placeholder="Action (ornek: user.ban)"
          className="input max-w-xs"
        />
        <input
          name="actorUserId"
          defaultValue={searchParams.actorUserId ?? ''}
          placeholder="Admin User ID"
          className="input max-w-xs"
        />
        <button type="submit" className="btn-primary">Filtrele</button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-textMuted">
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Hedef</th>
              <th className="px-4 py-3">Detay</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-textMuted">
                  Kayit bulunamadi
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="table-row">
                <td className="px-4 py-3 text-xs text-textMuted">
                  {new Date(log.createdAt).toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {log.actorUserId ? log.actorUserId.slice(0, 8) : 'SYSTEM'}
                </td>
                <td className="px-4 py-3">
                  <span className="badge">{log.action}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {log.targetType ?? '-'}
                  {log.targetId && (
                    <span className="ml-1 font-mono text-textMuted">{log.targetId.slice(0, 8)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-textMuted">
                  {log.metadata ? (
                    <code className="whitespace-pre-wrap break-all">
                      {JSON.stringify(log.metadata).slice(0, 200)}
                    </code>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
