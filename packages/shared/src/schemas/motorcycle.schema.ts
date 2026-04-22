import { z } from 'zod';

import { BikeStatusEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 3.2 - Motorcycle (Garaj) modeli

export const MotorcycleSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int(),
  displacement: z.number().int().nullable(),
  nickname: z.string().nullable(),
  photos: z.array(z.string().url()),
  modifications: z.string().nullable(),
  status: BikeStatusEnum,
  isPrimary: z.boolean(),
  mileage: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Motorcycle = z.infer<typeof MotorcycleSchema>;

export const CreateMotorcycleSchema = z.object({
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  year: z
    .number()
    .int()
    .min(1900, 'year_too_old')
    .max(new Date().getFullYear() + 1, 'year_in_future'),
  displacement: z.number().int().positive().max(3000).optional(),
  nickname: z.string().max(40).optional(),
  photos: z.array(z.string().url()).max(10).default([]),
  modifications: z.string().max(1000).optional(),
  status: BikeStatusEnum.default('ACTIVE'),
  isPrimary: z.boolean().default(false),
  mileage: z.number().int().nonnegative().optional(),
});
export type CreateMotorcycleDto = z.infer<typeof CreateMotorcycleSchema>;

export const UpdateMotorcycleSchema = CreateMotorcycleSchema.partial();
export type UpdateMotorcycleDto = z.infer<typeof UpdateMotorcycleSchema>;

export const MotorcycleApiResponseSchema = MotorcycleSchema.extend({
  createdAt: DateLikeSchema,
  updatedAt: DateLikeSchema,
}).passthrough();

export const MotorcycleListResponseSchema = z.array(MotorcycleApiResponseSchema);
