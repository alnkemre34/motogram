// Spec 8.7.1 + 4.4 - Acil durum rate limit ve yanlis tiklama korumasi sabitleri.

export const EMERGENCY_RATE = {
  // Spec 8.7.1 - 10 dk icinde 3'ten fazla SOS -> hesap kisitlama + admin bildirim.
  maxAlertsPer10Min: 3,
  windowSeconds: 600,
} as const;

// Spec 4.4 - SOS 3sn basili tutma. Server tarafi telemetri: client holdDurationMs gonderir.
// <3000 gelirse logged as suspect; ama yine de SOS yaratilir (spec net degil).
export const SOS_MIN_HOLD_MS = 3000;

// Spec 2.3.2 - SOS yaricap. Default 5 km, kullanici 500m-20km araliginda ayarlayabilir.
export const EMERGENCY_DEFAULT_RADIUS_M = 5000;

// Redis anahtarlari
export const EMERGENCY_REDIS_KEYS = {
  rateCount: (userId: string) => `rate:sos:${userId}`,
  falseAlarmFlag: (userId: string) => `sos:false_alarm_flag:${userId}`,
  adminNotifyLock: (userId: string) => `sos:admin_notified:${userId}`,
} as const;

// Performans butcesi
export const EMERGENCY_PERF = {
  notifyNearbyMaxMs: 2000,
  maxRecipients: 100,
} as const;
