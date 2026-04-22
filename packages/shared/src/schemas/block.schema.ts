import { z } from 'zod';

// Spec 7.2.2 - Engelleme. Faz 1'de model eklenmisti; REST katmani Faz 4.
export const BlockUserParamSchema = z.object({
  userId: z.string().uuid(),
});
export type BlockUserParamDto = z.infer<typeof BlockUserParamSchema>;

export const BlockDtoSchema = z.object({
  targetId: z.string().uuid(),
  createdAt: z.string(),
});
export type BlockDto = z.infer<typeof BlockDtoSchema>;
