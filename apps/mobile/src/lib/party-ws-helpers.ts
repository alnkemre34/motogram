import type { PartyDetail, PartyStatus } from '@motogram/shared';

/**
 * `party:status_changed` WS yüklemesini `PartyDetail` üzerine idempotent uygular (test edilebilir).
 */
export function applyPartyStatusChange(detail: PartyDetail, status: PartyStatus): PartyDetail {
  if (detail.status === status) return detail;
  return { ...detail, status };
}
