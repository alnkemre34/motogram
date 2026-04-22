// Spec 8.11.1 - Feature Flag Sistemi
// Kademeli ozellik aktivasyonu icin Redis tabanli flag servisi.
// Ornek flagler: enable_voice_rooms, enable_creator_channels, map_clustering_enabled.
import { z } from 'zod';

export const FeatureFlagStrategyEnum = z.enum(['OFF', 'ON', 'PERCENTAGE', 'USER_LIST']);
export type FeatureFlagStrategy = z.infer<typeof FeatureFlagStrategyEnum>;

export const FeatureFlagKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,63}$/, 'snake_case, 2-64 karakter, harfle baslamali');

// Redis hash degeri bu sema ile serialize edilir.
export const FeatureFlagValueSchema = z
  .object({
    strategy: FeatureFlagStrategyEnum,
    percentage: z.number().int().min(0).max(100).optional(),
    userIds: z.array(z.string().uuid()).max(1000).optional(),
    description: z.string().max(500).optional(),
    updatedAt: z.string().datetime().optional(),
    updatedBy: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.strategy === 'PERCENTAGE' && val.percentage === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PERCENTAGE strategy icin `percentage` zorunlu',
        path: ['percentage'],
      });
    }
    if (val.strategy === 'USER_LIST' && (!val.userIds || val.userIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'USER_LIST strategy icin en az 1 userId gerekli',
        path: ['userIds'],
      });
    }
  });
export type FeatureFlagValueDto = z.infer<typeof FeatureFlagValueSchema>;

export const FeatureFlagDtoSchema = z.object({
  key: FeatureFlagKeySchema,
  value: FeatureFlagValueSchema,
});
export type FeatureFlagDto = z.infer<typeof FeatureFlagDtoSchema>;

export const UpsertFeatureFlagSchema = z.object({
  key: FeatureFlagKeySchema,
  strategy: FeatureFlagStrategyEnum,
  percentage: z.number().int().min(0).max(100).optional(),
  userIds: z.array(z.string().uuid()).max(1000).optional(),
  description: z.string().max(500).optional(),
});
export type UpsertFeatureFlagDto = z.infer<typeof UpsertFeatureFlagSchema>;

export const EvaluateFeatureFlagSchema = z.object({
  key: FeatureFlagKeySchema,
  userId: z.string().uuid().optional(),
});
export type EvaluateFeatureFlagDto = z.infer<typeof EvaluateFeatureFlagSchema>;

export const FeatureFlagEvaluationSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  strategy: FeatureFlagStrategyEnum,
  // PERCENTAGE ve USER_LIST durumlarinda hangi user icin evaluate edildigini belirtir.
  userId: z.string().uuid().optional(),
  reason: z.string().optional(),
});
export type FeatureFlagEvaluationDto = z.infer<typeof FeatureFlagEvaluationSchema>;

// Redis key prefix'i: feature_flag:{key} (hash). Bu sabit backend + admin paneli
// tarafindan paylasilir.
export const FEATURE_FLAG_REDIS_PREFIX = 'feature_flag:';

export const FeatureFlagsListResponseSchema = z.array(FeatureFlagDtoSchema);
