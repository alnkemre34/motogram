'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminApi, type AdminUser } from '@/lib/api-client';

export function UsersTable({
  users,
  canChangeRole,
}: {
  users: AdminUser[];
  canChangeRole: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const ban = useMutation({
    mutationFn: async (input: { id: string; reason: string; shadowOnly: boolean }) =>
      adminApi.banUser(input.id, { reason: input.reason, shadowOnly: input.shadowOnly }),
    onSettled: () => {
      setBusy(null);
      router.refresh();
    },
  });
  const unban = useMutation({
    mutationFn: async (id: string) => adminApi.unbanUser(id),
    onSettled: () => {
      setBusy(null);
      router.refresh();
    },
  });
  const setRole = useMutation({
    mutationFn: async (input: { id: string; role: AdminUser['role'] }) =>
      adminApi.setUserRole(input.id, { role: input.role }),
    onSettled: () => {
      setBusy(null);
      router.refresh();
    },
  });

  if (users.length === 0) {
    return <div className="card text-center text-sm text-textMuted">Eslesen kullanici yok.</div>;
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-textMuted">
            <th className="px-4 py-3">Kullanici</th>
            <th className="px-4 py-3">E-posta</th>
            <th className="px-4 py-3">Rol</th>
            <th className="px-4 py-3">Durum</th>
            <th className="px-4 py-3">Katilma</th>
            <th className="px-4 py-3 text-right">Eylem</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="table-row">
              <td className="px-4 py-3">
                <div className="font-medium">{u.username}</div>
                <div className="text-xs text-textMuted">
                  Lv.{u.level} · {u.followersCount} takipci
                </div>
              </td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3">
                {canChangeRole ? (
                  <select
                    className="input w-32"
                    defaultValue={u.role}
                    disabled={busy === u.id}
                    onChange={(e) => {
                      setBusy(u.id);
                      setRole.mutate({ id: u.id, role: e.target.value as AdminUser['role'] });
                    }}
                  >
                    <option value="USER">USER</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                ) : (
                  <span className="badge">{u.role}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {u.isBanned && (
                  <span className="rounded bg-accentDanger/20 px-2 py-0.5 text-xs text-accentDanger">
                    BANLI
                  </span>
                )}
                {u.shadowBanned && (
                  <span className="ml-1 rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
                    GOLGE
                  </span>
                )}
                {!u.isBanned && !u.shadowBanned && (
                  <span className="rounded bg-accentSuccess/20 px-2 py-0.5 text-xs text-accentSuccess">
                    AKTIF
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-textMuted">
                {new Date(u.createdAt).toLocaleDateString('tr-TR')}
              </td>
              <td className="px-4 py-3 text-right">
                {u.isBanned ? (
                  <button
                    className="rounded bg-accentSuccess/20 px-2 py-1 text-xs text-accentSuccess hover:bg-accentSuccess/30"
                    disabled={busy === u.id}
                    onClick={() => {
                      setBusy(u.id);
                      unban.mutate(u.id);
                    }}
                  >
                    Ban Kaldir
                  </button>
                ) : (
                  <div className="flex justify-end gap-1">
                    <button
                      className="rounded bg-accent/20 px-2 py-1 text-xs text-accent hover:bg-accent/30"
                      disabled={busy === u.id}
                      onClick={() => {
                        const reason = window.prompt('Golge ban sebebi?');
                        if (!reason) return;
                        setBusy(u.id);
                        ban.mutate({ id: u.id, reason, shadowOnly: true });
                      }}
                    >
                      Golge Ban
                    </button>
                    <button
                      className="rounded bg-accentDanger/20 px-2 py-1 text-xs text-accentDanger hover:bg-accentDanger/30"
                      disabled={busy === u.id}
                      onClick={() => {
                        const reason = window.prompt('Ban sebebi?');
                        if (!reason) return;
                        setBusy(u.id);
                        ban.mutate({ id: u.id, reason, shadowOnly: false });
                      }}
                    >
                      Banla
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
