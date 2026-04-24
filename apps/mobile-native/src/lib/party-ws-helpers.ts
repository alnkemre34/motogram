import type { PartyDetail, PartyStatus } from '@motogram/shared';

export function applyPartyStatusChange(detail: PartyDetail, status: PartyStatus): PartyDetail {
  if (detail.status === status) return detail;
  return { ...detail, status };
}
