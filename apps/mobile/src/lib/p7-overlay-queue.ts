/** Global P7 toast üst sınırı (bellek / ekran taşması önlemi). */
export const P7_OVERLAY_MAX = 5;

export function capOverlayQueue<T>(current: T[], incoming: T, max: number = P7_OVERLAY_MAX): T[] {
  const next = [...current, incoming];
  if (next.length <= max) return next;
  return next.slice(next.length - max);
}
