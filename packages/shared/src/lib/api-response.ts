import { z } from 'zod';

/** Prisma Date / ISO string — response validation icin */
export const DateLikeSchema = z.union([
  z.string().datetime(),
  z.date().transform((d) => d.toISOString()),
]);

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      data: z.array(item),
      nextCursor: z.string().nullable(),
      hasMore: z.boolean(),
    })
    .passthrough();

export const OkTrueSchema = z.object({ ok: z.literal(true) });

/** { success: true } — yorum silme, motosiklet silme, kullanıcı aksiyonları vb. */
export const SuccessTrueSchema = z.object({ success: z.literal(true) });

export const KeyRemovedResponseSchema = z.object({
  key: z.string(),
  removed: z.boolean(),
});

export const HealthLivezSchema = z.object({ ok: z.literal(true) });

export const HealthReadyzSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
});

export const FollowActionResponseSchema = z.object({ status: z.string() });

export const FollowUnfollowResponseSchema = SuccessTrueSchema;
