import type { NearbyRider } from '@motogram/shared';

// Spec 7.1.1 - Optimistic UI: socket/REST arasi gelen canli konum guncellemesini
// mevcut markers listesine merge eder (immutable, saf fonksiyon).
// - Yeni rider: listeye eklenir.
// - Ayni userId varsa: lat/lng/heading/distance overwrite (mutasyon yok).
// - Rider "offline" durumuna geldiyse (lastPingAt 0 veya eski) listeden silinir.

export interface MarkerUpdate {
  userId: string;
  lat: number;
  lng: number;
  heading?: number | null;
  distance?: number;
  inParty?: boolean;
  partyId?: string | null;
  lastPingAt?: number;
  removed?: boolean;
}

export function applyMarkerUpdate(
  current: readonly NearbyRider[],
  update: MarkerUpdate,
): NearbyRider[] {
  if (update.removed) {
    return current.filter((r) => r.userId !== update.userId);
  }
  const idx = current.findIndex((r) => r.userId === update.userId);
  if (idx === -1) {
    // Yeni rider - username/avatarUrl REST'ten gelecek, placeholder tutma yerine
    // yok sayiyoruz ki UI gercek veriyi almadan render etmesin (Kural 5).
    if (!update.lastPingAt) return current.slice();
    return current.slice();
  }
  const existing = current[idx]!;
  const next: NearbyRider = {
    ...existing,
    lat: update.lat,
    lng: update.lng,
    heading: update.heading ?? existing.heading,
    distance: update.distance ?? existing.distance,
    inParty: update.inParty ?? existing.inParty,
    partyId: update.partyId ?? existing.partyId,
    lastPingAt: update.lastPingAt ?? existing.lastPingAt,
  };
  const copy = current.slice();
  copy[idx] = next;
  return copy;
}

/**
 * Spec 7.3.3 - Client tarafi zombi temizligi: 5dk+ guncellenmemis marker'lari
 * listeden siler (sunucu tarafi zaten ZREM yapiyor ama UI tepkisi icin).
 */
export function pruneStaleMarkers(
  markers: readonly NearbyRider[],
  now: number,
  ttlMs = 5 * 60 * 1000,
): NearbyRider[] {
  return markers.filter((m) => now - m.lastPingAt < ttlMs);
}
