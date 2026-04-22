import { z } from 'zod';

/** Katilim talebi opsiyonel mesaji (JoinCommunitySchema.message). */
export const CommunityJoinMessageSchema = z.object({
  message: z.string().max(500),
});

export type CommunityJoinMessageValues = z.infer<typeof CommunityJoinMessageSchema>;
