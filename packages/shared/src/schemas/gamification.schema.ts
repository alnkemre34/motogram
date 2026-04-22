import { z } from 'zod';

import {
  BadgeRarityEnum,
  QuestResetPeriodEnum,
  QuestTriggerEnum,
} from '../enums';

// Spec 2.6 + 3.2 + 3.6 - Quest/Badge DTOs (SSOT).

// ============ BADGE ============

export const BadgeDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  iconUrl: z.string().url().nullable(),
  category: z.string().nullable(),
  rarity: BadgeRarityEnum,
  xpReward: z.number().int().nonnegative(),
  isActive: z.boolean(),
});
export type BadgeDto = z.infer<typeof BadgeDtoSchema>;

export const UserBadgeDtoSchema = z.object({
  badge: BadgeDtoSchema,
  earnedAt: z.string().datetime(),
  showcased: z.boolean(),
  source: z.string().nullable(),
});
export type UserBadgeDto = z.infer<typeof UserBadgeDtoSchema>;

export const ShowcaseUserBadgeSchema = z.object({
  badgeId: z.string().uuid(),
  showcased: z.boolean(),
});
export type ShowcaseUserBadgeDto = z.infer<typeof ShowcaseUserBadgeSchema>;

// ============ QUEST ============

export const QuestDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  trigger: QuestTriggerEnum,
  targetValue: z.number().int().positive(),
  xpReward: z.number().int().nonnegative(),
  badgeId: z.string().uuid().nullable(),
  repeatable: z.boolean(),
  resetPeriod: QuestResetPeriodEnum,
  isActive: z.boolean(),
});
export type QuestDto = z.infer<typeof QuestDtoSchema>;

export const QuestProgressDtoSchema = z.object({
  questId: z.string().uuid(),
  progress: z.number().int().nonnegative(),
  targetValue: z.number().int().positive(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  resetAt: z.string().datetime().nullable(),
  quest: QuestDtoSchema,
});
export type QuestProgressDto = z.infer<typeof QuestProgressDtoSchema>;

// ============ TRIGGER PAYLOAD (internal EventEmitter -> GamificationService) ============

// Spec 3.6 - GamificationService.triggerQuest(userId, trigger, metadata).
// Internal kullanim: NestJS EventEmitter2 ile her servis bu payload'i emit eder.
export const GamificationTriggerPayloadSchema = z.object({
  userId: z.string().uuid(),
  trigger: QuestTriggerEnum,
  increment: z.number().int().positive().default(1),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});
export type GamificationTriggerPayload = z.infer<
  typeof GamificationTriggerPayloadSchema
>;

// ============ RESULT ============

export const QuestCompletedDtoSchema = z.object({
  questId: z.string().uuid(),
  questCode: z.string(),
  xpAwarded: z.number().int().nonnegative(),
  newUserLevel: z.number().int().positive(),
  newUserXp: z.number().int().nonnegative(),
  badgeUnlocked: BadgeDtoSchema.nullable(),
});
export type QuestCompletedDto = z.infer<typeof QuestCompletedDtoSchema>;

export const UserBadgesListResponseSchema = z.object({
  badges: z.array(UserBadgeDtoSchema),
});

export const UserQuestsListResponseSchema = z.object({
  quests: z.array(QuestProgressDtoSchema),
});
