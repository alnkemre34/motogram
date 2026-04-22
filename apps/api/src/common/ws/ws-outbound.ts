import { WS_OUTBOUND_SCHEMAS } from '@motogram/shared';

import type { MetricsService } from '../../modules/metrics/metrics.service';

/**
 * Server->client WS payload'larini SSOT semaya gore dogrular.
 * Uyusmezlik: zod_response_mismatch_total{route="ws:<event>"} + warn-only (strict degil).
 */
export function coerceWsOutboundPayload(
  event: string,
  payload: unknown,
  metrics: MetricsService,
): unknown {
  const schema = WS_OUTBOUND_SCHEMAS[event as keyof typeof WS_OUTBOUND_SCHEMAS];
  if (!schema) return payload;
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;
  metrics?.zodResponseMismatch?.inc({ route: `ws:${event}` });
  return payload;
}
