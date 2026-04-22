'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { adminApi, type FeatureFlag } from '@/lib/api-client';

export function FeatureFlagTable({ flags }: { flags: FeatureFlag[] }) {
  const router = useRouter();
  const del = useMutation({
    mutationFn: async (key: string) => adminApi.deleteFeatureFlag(key),
    onSuccess: () => router.refresh(),
  });

  if (flags.length === 0) {
    return <div className="card text-center text-sm text-textMuted">Kayitli flag yok.</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-textMuted">
            <th className="px-4 py-3">Key</th>
            <th className="px-4 py-3">Strateji</th>
            <th className="px-4 py-3">Yuzde</th>
            <th className="px-4 py-3">Kullanici</th>
            <th className="px-4 py-3">Aciklama</th>
            <th className="px-4 py-3 text-right">Eylem</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.key} className="table-row">
              <td className="px-4 py-3 font-mono text-xs">{f.key}</td>
              <td className="px-4 py-3">
                <span className="badge">{f.value.strategy}</span>
              </td>
              <td className="px-4 py-3">
                {f.value.strategy === 'PERCENTAGE' ? `${f.value.percentage ?? 0}%` : '-'}
              </td>
              <td className="px-4 py-3 text-xs text-textMuted">
                {f.value.strategy === 'USER_LIST' ? (f.value.userIds?.length ?? 0) : '-'}
              </td>
              <td className="px-4 py-3 text-xs text-textMuted">{f.value.description ?? '-'}</td>
              <td className="px-4 py-3 text-right">
                <button
                  className="rounded bg-accentDanger/20 px-2 py-1 text-xs text-accentDanger hover:bg-accentDanger/30"
                  onClick={() => {
                    if (window.confirm(`${f.key} silinsin mi?`)) del.mutate(f.key);
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
