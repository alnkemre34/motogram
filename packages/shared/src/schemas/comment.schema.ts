import { z } from 'zod';

import { DateLikeSchema } from '../lib/api-response';

// Spec 3.2 - Comment modeli

export const CommentSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string(),
  mentionedUserIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const CreateCommentSchema = z.object({
  postId: z.string().uuid('post_id_invalid'),
  content: z.string().min(1, 'content_required').max(500, 'content_too_long'),
  mentionedUserIds: z.array(z.string().uuid()).max(20).default([]),
});
export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(500),
});
export type UpdateCommentDto = z.infer<typeof UpdateCommentSchema>;

/** Prisma satiri (REST cevap) */
export const CommentRowResponseSchema = CommentSchema.extend({
  createdAt: DateLikeSchema,
  updatedAt: DateLikeSchema,
  deletedAt: DateLikeSchema.nullish().optional(),
}).passthrough();

export const CommentAuthorSnippetSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  isVerified: z.boolean(),
});

export const CommentWithAuthorResponseSchema = CommentRowResponseSchema.extend({
  user: CommentAuthorSnippetSchema,
});

export const CommentListPageResponseSchema = z.object({
  items: z.array(CommentWithAuthorResponseSchema),
  nextCursor: z.string().nullable(),
});
