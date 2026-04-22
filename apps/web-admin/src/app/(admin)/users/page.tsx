// Spec 5.4 - Kullanici moderasyonu (ban/unban, rol).
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; banned?: string };
}) {
  const session = await getServerSession(authOptions);
  const users = await adminApi
    .listUsers(
      {
        search: searchParams.q,
        role: searchParams.role as never,
        isBanned: searchParams.banned ? searchParams.banned === 'true' : undefined,
        limit: 50,
      },
      { accessToken: session?.accessToken },
    )
    .catch(() => []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Kullanicilar</h1>
        <p className="text-sm text-textMuted">
          Rol ataması, ban/unban islemleri burada yapilir. (Sadece ADMIN rolu rol degisikligi yapabilir)
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Kullanici adi / email"
          className="input max-w-xs"
        />
        <select
          name="role"
          defaultValue={searchParams.role ?? ''}
          className="input max-w-[160px]"
        >
          <option value="">Rol: Tumu</option>
          <option value="USER">USER</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          name="banned"
          defaultValue={searchParams.banned ?? ''}
          className="input max-w-[160px]"
        >
          <option value="">Ban: Tumu</option>
          <option value="true">Sadece Banli</option>
          <option value="false">Sadece Aktif</option>
        </select>
        <button type="submit" className="btn-primary">Filtrele</button>
      </form>

      <UsersTable users={users} canChangeRole={session?.role === 'ADMIN'} />
    </div>
  );
}
