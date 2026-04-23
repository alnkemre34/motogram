import { z } from 'zod';

import { LocationSharingModeEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

import { UsernameSchema } from './auth.schema';

// Spec 2.6 - Profil, 3.2 - User, UserSettings modelleri

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  coverImageUrl: z.string().url().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  ridingStyle: z.array(z.string()),
  isPrivate: z.boolean(),
  isVerified: z.boolean(),
  followersCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  postsCount: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const UserPublicApiResponseSchema = UserPublicSchema.extend({
  createdAt: DateLikeSchema,
}).passthrough();

export const UserMeResponseSchema = UserPublicApiResponseSchema.extend({
  email: z.string().email(),
  /** B-07 — Doğrulanmayı bekleyen yeni e-posta; yoksa null/omit. */
  pendingEmail: z.string().email().nullable().optional(),
  /** B-16 — Profilde kayıtlı E.164 telefon (yoksa null). */
  phoneNumber: z.string().nullable().optional(),
  phoneVerifiedAt: z.string().datetime().nullable().optional(),
  settings: z.unknown().nullable(),
}).passthrough();

export const UpdateProfileSchema = z.object({
  name: z.string().max(80).optional(),
  bio: z.string().max(250).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  ridingStyle: z.array(z.string().max(30)).max(10).optional(),
  isPrivate: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

/** GET /users/search (B-08) — query string; boş cursor atlanır. */
export const UserSearchQuerySchema = z.object({
  q: z.string().min(2).max(50),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  cursor: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().uuid().optional(),
  ),
});
export type UserSearchQueryDto = z.infer<typeof UserSearchQuerySchema>;

export const UserSearchResponseSchema = z.object({
  items: z.array(UserPublicApiResponseSchema),
  nextCursor: z.string().uuid().nullable(),
});
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

/** B-06 — Depoda küçük harf; URL/girdi karışık olsa da tekilleştirme. */
export function normalizeUsernameForStorage(raw: string): string {
  return raw.trim().toLowerCase();
}

const RESERVED_USERNAMES_LOWER = new Set([
  'admin',
  'administrator',
  'mod',
  'moderator',
  'motogram',
  'motogramapp',
  'motogram_team',
  'motogramofficial',
  'support',
  'help',
  'root',
  'system',
  'api',
  'www',
  'mail',
  'noreply',
  'no-reply',
  'team',
  'staff',
  'security',
  'abuse',
  'official',
  'null',
  'undefined',
]);

export function isReservedUsername(username: string): boolean {
  const n = normalizeUsernameForStorage(username);
  if (!n) return true;
  if (RESERVED_USERNAMES_LOWER.has(n)) return true;
  if (n.startsWith('motogram')) return true;
  return false;
}

/** B-06 — `PATCH /users/me/username` */
export const ChangeUsernameSchema = z.object({
  username: UsernameSchema,
});
export type ChangeUsernameDto = z.infer<typeof ChangeUsernameSchema>;

export const UserSettingsSchema = z.object({
  language: z.enum(['tr', 'en']).default('tr'),
  unitsMetric: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  locationSharing: LocationSharingModeEnum.default('OFF'),
  notificationPrefs: z
    .object({
      push: z.boolean().default(true),
      followersOnly: z.boolean().default(false),
      likes: z.boolean().default(true),
      comments: z.boolean().default(true),
      mentions: z.boolean().default(true),
      emergencyNearby: z.boolean().default(true),
    })
    .default({}),
  privacyPrefs: z
    .object({
      showRidingStyle: z.boolean().default(true),
      showGarage: z.boolean().default(true),
      allowMessageFromStrangers: z.boolean().default(true),
    })
    .default({}),
  mapVisibilityPrefs: z
    .object({
      showOnMap: z.boolean().default(false),
    })
    .default({}),
  safetyPrefs: z
    .object({
      sosEnabled: z.boolean().default(true),
      crashDetection: z.boolean().default(false),
    })
    .default({}),
});
export type UserSettingsDto = z.infer<typeof UserSettingsSchema>;

export const UpdateUserSettingsSchema = UserSettingsSchema.partial();
export type UpdateUserSettingsDto = z.infer<typeof UpdateUserSettingsSchema>;
