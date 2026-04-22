import sharp from 'sharp';

import { SHARP_PARAMS } from './media.constants';
import { SharpProcessor } from './sharp.processor';

// Spec 3.4.2 - Sharp ile WebP donusum ve 300x300 thumbnail.

describe('SharpProcessor (Spec 3.4.2)', () => {
  const processor = new SharpProcessor();

  async function makeSamplePng(width = 2000, height = 1500): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 120, g: 200, b: 100 },
      },
    })
      .png()
      .toBuffer();
  }

  it('produces WebP thumbnail (300x300) and medium (<=1080w) buffers', async () => {
    const input = await makeSamplePng();
    const processed = await processor.processImage(input);

    expect(processed.bytesThumbnail).toBeGreaterThan(0);
    expect(processed.bytesMedium).toBeGreaterThan(0);

    const tMeta = await sharp(processed.thumbnail).metadata();
    expect(tMeta.format).toBe('webp');
    expect(tMeta.width).toBe(SHARP_PARAMS.thumbnailWidth);
    expect(tMeta.height).toBe(SHARP_PARAMS.thumbnailHeight);

    const mMeta = await sharp(processed.medium).metadata();
    expect(mMeta.format).toBe('webp');
    expect(mMeta.width).toBeLessThanOrEqual(SHARP_PARAMS.mediumWidth);
  });

  it('does not upscale smaller images (withoutEnlargement)', async () => {
    const small = await makeSamplePng(600, 400);
    const processed = await processor.processImage(small);
    const meta = await sharp(processed.medium).metadata();
    expect(meta.width).toBeLessThanOrEqual(600);
  });

  it('compresses to smaller output vs original', async () => {
    const input = await makeSamplePng();
    const processed = await processor.processImage(input);
    // WebP 85% should be much smaller than PNG
    expect(processed.bytesMedium).toBeLessThan(processed.bytesOriginal);
  });
});
