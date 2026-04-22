'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminApi, type AdminReport } from '@/lib/api-client';

export function ReportsTable({ reports }: { reports: AdminReport[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: async (input: { id: string; status: 'RESOLVED' | 'DISMISSED'; note: string }) =>
      adminApi.reviewReport(input.id, {
        status: input.status,
        resolutionNote: input.note,
      }),
    onSettled: async () => {
      setProcessing(null);
      await qc.invalidateQueries();
      router.refresh();
    },
  });

  if (reports.length === 0) {
    return <div className="card text-center text-sm text-textMuted">Rapor bulunmuyor.</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-textMuted">
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Tur</th>
            <th className="px-4 py-3">Sebep</th>
            <th className="px-4 py-3">Bildirilen</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Tarih</th>
            <th className="px-4 py-3 text-right">Eylem</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="table-row">
              <td className="px-4 py-3 font-mono text-xs">{r.id.slice(0, 8)}</td>
              <td className="px-4 py-3">{r.targetType}</td>
              <td className="px-4 py-3">{r.reason}</td>
              <td className="px-4 py-3 font-mono text-xs">
                {r.targetId ? r.targetId.slice(0, 8) : '-'}
              </td>
              <td className="px-4 py-3">
                <span className="badge">{r.status}</span>
              </td>
              <td className="px-4 py-3 text-xs text-textMuted">
                {new Date(r.createdAt).toLocaleString('tr-TR')}
              </td>
              <td className="px-4 py-3 text-right">
                {(r.status === 'PENDING' || r.status === 'REVIEWING') && (
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded bg-accentSuccess/20 px-2 py-1 text-xs text-accentSuccess hover:bg-accentSuccess/30"
                      disabled={processing === r.id}
                      onClick={() => {
                        setProcessing(r.id);
                        review.mutate({
                          id: r.id,
                          status: 'RESOLVED',
                          note: 'Admin tarafindan onaylandi',
                        });
                      }}
                    >
                      Onayla
                    </button>
                    <button
                      className="rounded bg-accentDanger/20 px-2 py-1 text-xs text-accentDanger hover:bg-accentDanger/30"
                      disabled={processing === r.id}
                      onClick={() => {
                        setProcessing(r.id);
                        review.mutate({
                          id: r.id,
                          status: 'DISMISSED',
                          note: 'Gecersiz rapor',
                        });
                      }}
                    >
                      Reddet
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
