'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { adminApi, type AbTestConfig } from '@/lib/api-client';

export function AbTestTable({ tests }: { tests: AbTestConfig[] }) {
  const router = useRouter();
  const del = useMutation({
    mutationFn: async (key: string) => adminApi.deleteAbTest(key),
    onSuccess: () => router.refresh(),
  });

  if (tests.length === 0) {
    return <div className="card text-center text-sm text-textMuted">Kayitli test yok.</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-textMuted">
            <th className="px-4 py-3">Key</th>
            <th className="px-4 py-3">Aciklama</th>
            <th className="px-4 py-3">Variants</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3 text-right">Eylem</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => (
            <tr key={t.key} className="table-row">
              <td className="px-4 py-3 font-mono text-xs">{t.key}</td>
              <td className="px-4 py-3 text-xs text-textMuted">{t.description ?? '-'}</td>
              <td className="px-4 py-3 text-xs">
                {t.variants.map((v) => `${v.id}:${v.weight}%`).join(' / ')}
              </td>
              <td className="px-4 py-3">
                {t.enabled ? (
                  <span className="rounded bg-accentSuccess/20 px-2 py-0.5 text-xs text-accentSuccess">
                    AKTIF
                  </span>
                ) : (
                  <span className="rounded bg-accentDanger/20 px-2 py-0.5 text-xs text-accentDanger">
                    PASIF
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  className="rounded bg-accentDanger/20 px-2 py-1 text-xs text-accentDanger hover:bg-accentDanger/30"
                  onClick={() => {
                    if (window.confirm(`${t.key} silinsin mi?`)) del.mutate(t.key);
                  }}
                >
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
