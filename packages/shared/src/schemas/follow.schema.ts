import { z } from 'zod';

import { FollowStatusEnum } from '../enums';

// Spec 3.2 - Follow modeli

export const FollowSchema = z.object({
  id: z.string().uuid(),
  followerId: z.string().uuid(),
  followingId: z.string().uuid(),
  status: FollowStatusEnum,
  createdAt: z.string().datetime(),
});
export type Follow = z.infer<typeof FollowSchema>;

export const FollowActionSchema = z.object({
  targetUserId: z.string().uuid('user_id_invalid'),
});
export type FollowActionDto = z.infer<typeof FollowActionSchema>;
