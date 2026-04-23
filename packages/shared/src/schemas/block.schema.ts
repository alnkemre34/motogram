import { z } from 'zod';

import { DateLikeSchema } from '../lib/api-response';

// Spec 7.2.2 - Engelleme. Faz 1'de model eklenmisti; REST katmani Faz 4.
export const BlockUserParamSchema = z.object({
  userId: z.string().uuid(),
});
export type BlockUserParamDto = z.infer<typeof BlockUserParamSchema>;

export const BlockDtoSchema = z.object({
  targetId: z.string().uuid(),
  createdAt: DateLikeSchema,
});
export type BlockDto = z.infer<typeof BlockDtoSchema>;

/** B-10 — `GET /v1/blocks` satırı. */
export const BlockListItemSchema = z.object({
  id: z.string().uuid(),
  targetId: z.string().uuid(),
  createdAt: DateLikeSchema,
});
export type BlockListItem = z.infer<typeof BlockListItemSchema>;

export const BlocksListResponseSchema = z.object({
  items: z.array(BlockListItemSchema),
});
export type BlocksListResponseDto = z.infer<typeof BlocksListResponseSchema>;
