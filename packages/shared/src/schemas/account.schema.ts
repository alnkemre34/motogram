import { z } from 'zod';

// Spec 5.2 + 8.11.4 - Hesap silme istegi: 30 gun bekleme + asenkron imha.

export const RequestAccountDeletionSchema = z.object({
  password: z.string().min(1).max(128).optional(),
  reason: z.string().max(500).optional(),
});
export type RequestAccountDeletionDto = z.infer<typeof RequestAccountDeletionSchema>;

export const AccountDeletionStatusSchema = z.object({
  pending: z.boolean(),
  requestedAt: z.string().datetime().nullable(),
  scheduledFor: z.string().datetime().nullable(),
  daysRemaining: z.number().int().nullable(),
});
export type AccountDeletionStatusDto = z.infer<typeof AccountDeletionStatusSchema>;
