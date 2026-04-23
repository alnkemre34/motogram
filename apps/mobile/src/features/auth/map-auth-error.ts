import type { TFunction } from 'i18next';

import { ApiClientError } from '../../lib/api-client';

type ApiErrBody = { error?: string; code?: number } | null;

function bodyFromError(err: unknown): ApiErrBody {
  if (err instanceof ApiClientError) return (err.body as { error?: string; code?: number } | null) ?? null;
  return null;
}

/**
 * `ApiClientError` gövde `error` string anahtarını `auth.errors.*` ile eşleştirir.
 */
export function mapAuthErrorToMessage(err: unknown, t: TFunction): string {
  const b = bodyFromError(err);
  const key = b?.error;
  if (key && key.length > 0) {
    const tr = t(`auth.errors.${key}`);
    if (tr !== `auth.errors.${key}`) return tr;
  }
  return t('common.error');
}
