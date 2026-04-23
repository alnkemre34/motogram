import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  ErrorCodes,
  MAX_MEDIA_BYTES,
  type InitiateMediaUploadDto,
  type InitiateMediaUploadResponseDto,
  type MediaAssetDto,
  type MediaCategory,
  type MediaProcessJobData,
} from '@motogram/shared';

import { PrismaService } from '../prisma/prisma.service';
import {
  MEDIA_KEYS,
  PRESIGN_TTL_SECONDS,
  SHARP_PARAMS,
} from './media.constants';
import { MinioService } from './minio.client';
import { MediaQueue } from './media.queue';
import { SharpProcessor } from './sharp.processor';

// Spec 3.4 - MediaService.
// initiateUpload -> MediaAsset(UPLOADING) + presigned PUT -> client upload -> finalize
// -> BullMQ job -> worker processImage -> thumbnail/medium MinIO'ya yaz -> asset READY.

function fileExtForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'bin';
  }
}

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly sharp: SharpProcessor,
    private readonly queue: MediaQueue,
  ) {}

  onModuleInit(): void {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    this.queue.registerProcessor((data) => this.processImageJob(data));
  }

  // Spec 7.3.4 - client istek gonderir, sunucu Limit + MIME kontrolunu yapar.
  async initiateUpload(
    userId: string,
    dto: InitiateMediaUploadDto,
  ): Promise<InitiateMediaUploadResponseDto> {
    if (dto.sizeBytes > MAX_MEDIA_BYTES) {
      throw new BadRequestException({
        error: 'payload_too_large',
        code: ErrorCodes.VALIDATION_FAILED,
        maxBytes: MAX_MEDIA_BYTES,
      });
    }
    const allowed =
      (ALLOWED_IMAGE_MIME as readonly string[]).includes(dto.mimeType) ||
      (ALLOWED_VIDEO_MIME as readonly string[]).includes(dto.mimeType);
    if (!allowed) {
      throw new BadRequestException({
        error: 'unsupported_mime',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }

    const ext = fileExtForMime(dto.mimeType);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        ownerId: userId,
        originalFilename: dto.filename,
        mimeType: dto.mimeType,
        category: dto.category,
        parentType: dto.parentType ?? null,
        parentId: dto.parentId ?? null,
        status: 'UPLOADING',
        sizeBytes: dto.sizeBytes,
        originalKey: MEDIA_KEYS.tempKey('placeholder', ext),
      },
    });
    // Asset id'yi anahtarda kullan.
    const originalKey = MEDIA_KEYS.tempKey(asset.id, ext);
    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { originalKey },
    });

    const uploadUrl = await this.minio.presignedPutObject(
      this.minio.defaultBucket,
      originalKey,
      PRESIGN_TTL_SECONDS,
    );

    return {
      assetId: asset.id,
      uploadUrl,
      objectKey: originalKey,
      bucket: this.minio.defaultBucket,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  // Spec 3.4.2 - client upload tamamladi -> isleme kuyrugu.
  async finalizeUpload(userId: string, assetId: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException({ error: 'asset_not_found' });
    if (asset.ownerId !== userId) {
      throw new ForbiddenException({ error: 'not_owner' });
    }
    if (asset.status !== 'UPLOADING') {
      // Idempotent: zaten islendi/isleniyor, mevcut dto'yu don.
      return this.toDto(asset);
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: 'PROCESSING' },
    });

    const jobData: MediaProcessJobData = {
      assetId: asset.id,
      originalKey: asset.originalKey!,
      bucket: asset.bucket,
      mimeType: asset.mimeType,
      category: asset.category as MediaCategory,
      ownerId: asset.ownerId,
      parentType: asset.parentType,
      parentId: asset.parentId,
    };
    await this.queue.enqueueImage(jobData);
    return this.toDto(updated);
  }

  // Spec 3.4.2 - BullMQ worker'dan cagrilir.
  async processImageJob(job: MediaProcessJobData): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: job.assetId },
    });
    if (!asset) return;
    if (asset.status === 'READY') return; // idempotent

    try {
      const buffer = await this.minio.getObject(job.bucket, job.originalKey);
      const processed = await this.sharp.processImage(buffer);

      const keys = this.destinationKeys(job, asset.id);
      await Promise.all([
        this.minio.putObject(job.bucket, keys.thumbnail, processed.thumbnail, 'image/webp'),
        this.minio.putObject(job.bucket, keys.medium, processed.medium, 'image/webp'),
      ]);

      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: 'READY',
          thumbnailKey: keys.thumbnail,
          mediumKey: keys.medium,
          width: processed.width,
          height: processed.height,
          sizeBytes: processed.bytesMedium,
          processingError: null,
        },
      });

      // Spec 3.4.2 - Gecici orijinali temizle.
      await this.minio
        .removeObject(job.bucket, job.originalKey)
        .catch((err) =>
          this.logger.warn(
            `media_temp_cleanup_failed assetId=${asset.id} err=${(err as Error).message}`,
          ),
        );
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { originalKey: null },
      });
    } catch (err) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: 'FAILED',
          processingError: (err as Error).message.slice(0, 500),
        },
      });
      this.logger.warn(
        `media_processing_failed assetId=${asset.id} err=${(err as Error).message}`,
      );
      throw err;
    }
  }

  // Spec 3.4.3 - Presigned GET URL (1 saat).
  async getPresignedUrl(objectKey: string, expiresSeconds = PRESIGN_TTL_SECONDS): Promise<string> {
    return this.minio.presignedGetObject(this.minio.defaultBucket, objectKey, expiresSeconds);
  }

  async getAsset(userId: string, assetId: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException({ error: 'asset_not_found' });
    if (asset.ownerId !== userId) {
      throw new ForbiddenException({ error: 'not_owner' });
    }
    return this.toDto(asset);
  }

  // Spec 8.11.4 - soft delete (fiziksel silme retention worker tarafindan).
  async softDelete(userId: string, assetId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null },
    });
    if (!asset) return;
    if (asset.ownerId !== userId) {
      throw new ForbiddenException({ error: 'not_owner' });
    }
    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    });
  }

  private destinationKeys(
    job: MediaProcessJobData,
    assetId: string,
  ): { thumbnail: string; medium: string } {
    switch (job.category) {
      case 'PROFILE_AVATAR':
        return {
          thumbnail: MEDIA_KEYS.profileAvatar(job.ownerId, assetId, 'thumbnail'),
          medium: MEDIA_KEYS.profileAvatar(job.ownerId, assetId, 'medium'),
        };
      case 'PROFILE_COVER': {
        const medium = MEDIA_KEYS.profileCover(job.ownerId, assetId);
        return { thumbnail: medium, medium };
      }
      case 'MOTORCYCLE_PHOTO':
        return {
          thumbnail: MEDIA_KEYS.garage(
            job.ownerId,
            job.parentId ?? 'unknown',
            assetId,
            'thumbnail',
          ),
          medium: MEDIA_KEYS.garage(
            job.ownerId,
            job.parentId ?? 'unknown',
            assetId,
            'medium',
          ),
        };
      case 'POST_IMAGE':
      case 'POST_VIDEO':
        return {
          thumbnail: MEDIA_KEYS.post(job.parentId ?? 'orphan', assetId, 'thumbnail'),
          medium: MEDIA_KEYS.post(job.parentId ?? 'orphan', assetId, 'medium'),
        };
      case 'STORY_IMAGE':
      case 'STORY_VIDEO': {
        const k = MEDIA_KEYS.story(job.parentId ?? 'orphan', assetId);
        return { thumbnail: k, medium: k };
      }
      case 'COMMUNITY_COVER': {
        const k = MEDIA_KEYS.communityCover(job.parentId ?? 'orphan', assetId);
        return { thumbnail: k, medium: k };
      }
      case 'EVENT_COVER': {
        const k = MEDIA_KEYS.eventCover(job.parentId ?? 'orphan', assetId);
        return { thumbnail: k, medium: k };
      }
      case 'MESSAGE_ATTACHMENT':
      default:
        return {
          thumbnail: MEDIA_KEYS.message(assetId, 'thumbnail'),
          medium: MEDIA_KEYS.message(assetId, 'medium'),
        };
    }
  }

  private async toDto(asset: {
    id: string;
    ownerId: string;
    category: string;
    parentType: string | null;
    parentId: string | null;
    status: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sizeBytes: number | null;
    durationMs: number | null;
    thumbnailKey: string | null;
    mediumKey: string | null;
    hlsPlaylistKey: string | null;
    createdAt: Date;
    bucket: string;
  }): Promise<MediaAssetDto> {
    const [thumbnailUrl, mediumUrl, hlsUrl] = await Promise.all([
      asset.thumbnailKey
        ? this.minio.presignedGetObject(asset.bucket, asset.thumbnailKey, PRESIGN_TTL_SECONDS).catch(() => null)
        : Promise.resolve(null),
      asset.mediumKey
        ? this.minio.presignedGetObject(asset.bucket, asset.mediumKey, PRESIGN_TTL_SECONDS).catch(() => null)
        : Promise.resolve(null),
      asset.hlsPlaylistKey
        ? this.minio.presignedGetObject(asset.bucket, asset.hlsPlaylistKey, PRESIGN_TTL_SECONDS).catch(() => null)
        : Promise.resolve(null),
    ]);
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      category: asset.category as MediaCategory,
      parentType: asset.parentType,
      parentId: asset.parentId,
      status: asset.status as MediaAssetDto['status'],
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      durationMs: asset.durationMs,
      thumbnailUrl,
      mediumUrl,
      hlsUrl,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}

// Unused constants pinned to avoid tree-shake warnings.
export const _SHARP_PARAMS = SHARP_PARAMS;
