import type { ThermalState } from '@motogram/shared';

export function computeLocationIntervalMs(thermalState: ThermalState, isSharing: boolean): number {
  if (!isSharing) return 0;
  switch (thermalState) {
    case 'CRITICAL':
      return 10_000;
    case 'SERIOUS':
      return 8_000;
    case 'FAIR':
      return 5_000;
    case 'NORMAL':
    default:
      return 3_000;
  }
}
