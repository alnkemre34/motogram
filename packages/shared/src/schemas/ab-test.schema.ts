// Spec 8.11.2 - A/B Test Altyapisi
// Kullanicilar userId hash'ine gore deney gruplarina ayrilir (A / B / CONTROL / vb).
// Feed algoritmasi veya UI degisiklikleri bu gruplara gore olculur.
import { z } from 'zod';

export const AbTestVariantSchema = z.object({
  id: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{0,31}$/, 'UPPER_SNAKE_CASE, 1-32 karakter')
    .describe('Variant kimligi, orn: A / B / CONTROL / VARIANT_X'),
  weight: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe('Dagilim agirligi (1-100); toplam tum variantlarda 100 olmali'),
  label: z.string().max(120).optional(),
});
export type AbTestVariantDto = z.infer<typeof AbTestVariantSchema>;

export const AbTestKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,63}$/, 'snake_case, 2-64 karakter');

export const AbTestConfigSchema = z
  .object({
    key: AbTestKeySchema,
    description: z.string().max(500).optional(),
    variants: z.array(AbTestVariantSchema).min(2).max(6),
    enabled: z.boolean().default(true),
    createdAt: z.string().datetime().optional(),
    updatedBy: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    const total = val.variants.reduce((sum, v) => sum + v.weight, 0);
    if (total !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Variant agirlik toplami 100 olmali (gelen: ${total})`,
        path: ['variants'],
      });
    }
    const ids = val.variants.map((v) => v.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Variant id tekrar edemez',
        path: ['variants'],
      });
    }
  });
export type AbTestConfigDto = z.infer<typeof AbTestConfigSchema>;

export const UpsertAbTestSchema = AbTestConfigSchema;
export type UpsertAbTestDto = z.infer<typeof UpsertAbTestSchema>;

export const AbTestAssignmentSchema = z.object({
  key: z.string(),
  userId: z.string().uuid(),
  variant: z.string(),
  assignedAt: z.string().datetime().optional(),
});
export type AbTestAssignmentDto = z.infer<typeof AbTestAssignmentSchema>;

// Redis key prefix'leri (Spec 8.11.2).
// ab_test:config:{key}        -> JSON (variant tanimlari)
// ab_test:assign:{key}:{uid}  -> variant id (string)
export const AB_TEST_CONFIG_PREFIX = 'ab_test:config:';
export const AB_TEST_ASSIGN_PREFIX = 'ab_test:assign:';

export const AbTestListResponseSchema = z.array(AbTestConfigSchema);
export const AbTestDeleteResponseSchema = z.object({
  key: z.string(),
  removed: z.boolean(),
});
export const AbTestAssignmentClientResponseSchema = z.object({
  key: z.string(),
  userId: z.string().uuid(),
  variant: z.string(),
});
