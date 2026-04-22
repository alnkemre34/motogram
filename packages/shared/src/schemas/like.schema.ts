import { z } from 'zod';

// Spec 3.2 - Like modeli, 7.1.1 - Optimistik UI (begeni)

export const LikeSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Like = z.infer<typeof LikeSchema>;

export const LikeActionSchema = z.object({
  postId: z.string().uuid('post_id_invalid'),
});
export type LikeActionDto = z.infer<typeof LikeActionSchema>;

export const LikeToggleResponseSchema = z.object({
  liked: z.boolean(),
  likesCount: z.number().int().nonnegative(),
});
