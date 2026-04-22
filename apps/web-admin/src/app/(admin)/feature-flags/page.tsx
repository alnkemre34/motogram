// Spec 8.11 - Feature flag yonetimi.
// On/Off + Percentage rollout + User allowlist.
import { getServerSession } from 'next-auth/next';

import { adminApi } from '@/lib/api-client';
import { authOptions } from '@/lib/auth';

import { FeatureFlagForm } from './feature-flag-form';
import { FeatureFlagTable } from './feature-flag-table';

export const dynamic = 'force-dynamic';

export default async function FeatureFlagsPage() {
  const session = await getServerSession(authOptions);
  const flags = await adminApi
    .listFeatureFlags({ accessToken: session?.accessToken })
    .catch(() => []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Feature Flag'ler</h1>
        <p className="text-sm text-textMuted">
          Mobile client'larin canlida erismesi icin ozelliklere on/off, yuzdelik veya whitelist bazli
          kural yaz.
        </p>
      </div>

      <FeatureFlagForm />

      <FeatureFlagTable flags={flags} />
    </div>
  );
}
