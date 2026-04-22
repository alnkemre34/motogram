/**
 * MinIO + presigned PUT + finalize + BullMQ image worker (E2E_MEDIA_WORKER=1) + GET asset READY.
 * Docker: docker-compose.e2e.yml icinde minio + postgres + redis.
 */
import * as net from 'node:net';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import {
  AuthResultSchema,
  InitiateMediaUploadResponseSchema,
  MediaAssetDtoSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

function assertMinioReachable(): Promise<void> {
  const host = process.env.MINIO_ENDPOINT || 'localhost';
  const port = Number(process.env.MINIO_PORT ?? '9000');
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      clearTimeout(t);
      socket.end();
      resolve();
    });
    const t = setTimeout(() => {
      socket.destroy();
      reject(
        new Error(
          [
            `E2E (media): MinIO ulasilamiyor (${host}:${port}).`,
            '  Repo kokunden: docker compose -f docker-compose.e2e.yml up -d',
          ].join('\n'),
        ),
      );
    }, 2000);
    socket.on('error', (err) => {
      clearTimeout(t);
      reject(
        new Error(
          [
            `E2E (media): MinIO ulasilamiyor (${host}:${port}): ${err.message}`,
            '  docker compose -f docker-compose.e2e.yml up -d',
          ].join('\n'),
          { cause: err },
        ),
      );
    });
  });
}

describeE2E('E2E: medya (MinIO + Sharp + BullMQ)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    await assertMinioReachable();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    const suffix = Date.now().toString(36);
    const reg = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `media-${suffix}@example.com`,
        username: `med_${suffix}`.slice(0, 30),
        password: 'MediaE2e1!z',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const { tokens } = AuthResultSchema.parse(reg.body);
    accessToken = tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('POST initiate -> PUT MinIO -> finalize -> GET READY', async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } })
      .png()
      .toBuffer();

    const initRes = await request(app.getHttpServer())
      .post('/v1/media/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'POST_IMAGE',
        filename: 'e2e.png',
        mimeType: 'image/png',
        sizeBytes: png.length,
      })
      .expect(201);
    const init = InitiateMediaUploadResponseSchema.parse(initRes.body);

    const putRes = await fetch(init.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: new Uint8Array(png),
    });
    expect(putRes.ok).toBe(true);

    const finRes = await request(app.getHttpServer())
      .post('/v1/media/uploads/finalize')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ assetId: init.assetId })
      .expect(200);
    MediaAssetDtoSchema.parse(finRes.body);

    const deadline = Date.now() + 45_000;
    let last: unknown;
    while (Date.now() < deadline) {
      const getRes = await request(app.getHttpServer())
        .get(`/v1/media/${init.assetId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      last = getRes.body;
      if (getRes.status === 200) {
        const dto = MediaAssetDtoSchema.safeParse(getRes.body);
        if (dto.success && dto.data.status === 'READY') {
          expect(dto.data.thumbnailUrl).toBeTruthy();
          await request(app.getHttpServer())
            .delete(`/v1/media/${init.assetId}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(204);
          return;
        }
        if (dto.success && dto.data.status === 'FAILED') {
          throw new Error(`media_processing_failed: ${JSON.stringify(getRes.body)}`);
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error(`media_not_ready_timeout last=${JSON.stringify(last)}`);
  }, 90_000);
});
