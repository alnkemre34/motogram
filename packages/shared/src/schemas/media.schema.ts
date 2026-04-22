import { z } from 'zod';

import { MediaCategoryEnum, MediaStatusEnum } from '../enums';

// Spec 3.4 + 7.3.4 + 7.3.7 - Medya DTO + upload API.

// Spec 7.3.4 - multer limiti 15MB.
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

// Spec 7.3.4 - 10 eszamanli dosya sinira kadar.
export const MAX_CONCURRENT_UPLOADS = 10;

// Kabul edilen MIME tipleri (Spec 3.4.2 - WebP donusumu hedef).
export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;
export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/quicktime'] as const;

export const InitiateMediaUploadSchema = z.object({
  category: MediaCategoryEnum,
  parentType: z.string().max(32).optional(),
  parentId: z.string().uuid().optional(),
  filename: z.string().min(1).max(200),
  mimeType: z.string().refine(
    (m) =>
      (ALLOWED_IMAGE_MIME as readonly string[]).includes(m) ||
      (ALLOWED_VIDEO_MIME as readonly string[]).includes(m),
    { message: 'unsupported_mime' },
  ),
  sizeBytes: z.number().int().positive().max(MAX_MEDIA_BYTES),
});
export type InitiateMediaUploadDto = z.infer<typeof InitiateMediaUploadSchema>;

export const InitiateMediaUploadResponseSchema = z.object({
  assetId: z.string().uuid(),
  uploadUrl: z.string().url(), // Presigned PUT URL (Spec 3.4.3)
  objectKey: z.string(),
  bucket: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type InitiateMediaUploadResponseDto = z.infer<
  typeof InitiateMediaUploadResponseSchema
>;

// Upload complete -> sunucu Sharp pipeline'ina gonderir (BullMQ).
export const FinalizeMediaUploadSchema = z.object({
  assetId: z.string().uuid(),
});
export type FinalizeMediaUploadDto = z.infer<typeof FinalizeMediaUploadSchema>;

export const MediaAssetDtoSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  category: MediaCategoryEnum,
  parentType: z.string().nullable(),
  parentId: z.string().nullable(),
  status: MediaStatusEnum,
  mimeType: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sizeBytes: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  thumbnailUrl: z.string().url().nullable(), // Presigned GET URL
  mediumUrl: z.string().url().nullable(),
  hlsUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});
export type MediaAssetDto = z.infer<typeof MediaAssetDtoSchema>;

// BullMQ is payload (internal - shared for type safety between producer/consumer).
export const MediaProcessJobDataSchema = z.object({
  assetId: z.string().uuid(),
  originalKey: z.string(),
  bucket: z.string(),
  mimeType: z.string(),
  category: MediaCategoryEnum,
  ownerId: z.string().uuid(),
  parentType: z.string().nullable(),
  parentId: z.string().nullable(),
});
export type MediaProcessJobData = z.infer<typeof MediaProcessJobDataSchema>;
