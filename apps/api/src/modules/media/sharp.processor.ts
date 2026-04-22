import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

import { SHARP_PARAMS } from './media.constants';

// Spec 3.4.2 - Sharp ile goruntu optimizasyonu (WebP 85%, 300x300 thumbnail, 1080w medium).

export interface ProcessedImage {
  thumbnail: Buffer;
  medium: Buffer;
  width: number;
  height: number;
  format: string;
  bytesOriginal: number;
  bytesThumbnail: number;
  bytesMedium: number;
}

@Injectable()
export class SharpProcessor {
  private readonly logger = new Logger(SharpProcessor.name);

  async processImage(input: Buffer): Promise<ProcessedImage> {
    // EXIF orientation auto-rotate + metadata oku
    const img = sharp(input, { failOn: 'error' }).rotate();
    const meta = await img.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // Sharp WebP 85% (Spec 3.4.2)
    // Thumbnail 300x300 (cover kirpma), Medium 1080w genislikte (aspect korunur).
    const [thumbnail, medium] = await Promise.all([
      sharp(input)
        .rotate()
        .resize(SHARP_PARAMS.thumbnailWidth, SHARP_PARAMS.thumbnailHeight, {
          fit: 'cover',
          position: 'attention',
        })
        .webp({ quality: SHARP_PARAMS.webpQuality })
        .toBuffer(),
      sharp(input)
        .rotate()
        .resize({
          width: SHARP_PARAMS.mediumWidth,
          withoutEnlargement: true,
        })
        .webp({ quality: SHARP_PARAMS.webpQuality })
        .toBuffer(),
    ]);

    const result: ProcessedImage = {
      thumbnail,
      medium,
      width,
      height,
      format: meta.format ?? 'unknown',
      bytesOriginal: input.byteLength,
      bytesThumbnail: thumbnail.byteLength,
      bytesMedium: medium.byteLength,
    };

    this.logger.debug(
      `sharp_processed original=${input.byteLength}B medium=${medium.byteLength}B thumbnail=${thumbnail.byteLength}B`,
    );

    return result;
  }
}
