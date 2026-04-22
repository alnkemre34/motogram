import { createHmac, randomUUID } from 'node:crypto';

/** Internal fanout guard ile ayni canonical body imzasi (supertest JSON sirasi = tek kaynak). */
export function internalFanoutHeaders(body: Record<string, unknown>, secret: string): Record<string, string> {
  const ts = String(Date.now());
  const nonce = randomUUID();
  const bodyStr = JSON.stringify(body ?? {});
  const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${bodyStr}`).digest('hex');
  return {
    'content-type': 'application/json',
    'x-internal-ts': ts,
    'x-internal-nonce': nonce,
    'x-internal-sig': sig,
  };
}
