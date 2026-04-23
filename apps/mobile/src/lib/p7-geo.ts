/**
 * SOS “yakın” mesafesi için kısa metin (toast gövdesi; i18n dışı sayı bölümü).
 */
export function formatDistanceMeters(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
