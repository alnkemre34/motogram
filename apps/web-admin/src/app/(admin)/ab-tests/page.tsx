// Spec 8.11 - A/B test konfigurasyonu + variant agirliklari.
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

import { AbTestForm } from './ab-test-form';
import { AbTestTable } from './ab-test-table';

export const dynamic = 'force-dynamic';

export default async function AbTestsPage() {
  const session = await getServerSession(authOptions);
  const tests = await adminApi
    .listAbTests({ accessToken: session?.accessToken })
    .catch(() => []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">A/B Testleri</h1>
        <p className="text-sm text-textMuted">
          Her kullanici icin deterministik atama — UserID + TestKey hash'i uzerinden variant secilir.
        </p>
      </div>

      <AbTestForm />
      <AbTestTable tests={tests} />
    </div>
  );
}
