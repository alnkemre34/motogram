/**
 * Contract-style checks — HTTP JSON govdesini shared Zod ile dogrular.
 * Postgres + Redis + uygulanmis migration gerekir (bos DB'de register icin tablolar).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  ApiErrorSchema,
  AuthResultSchema,
  ConversationsListResponseSchema,
  HealthLivezSchema,
  HealthReadyzSchema,
  MapShardStatsResponseSchema,
  NearbyRidersResponseSchema,
  PostFeedPageSchema,
} from '@motogram/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RouteRecord } from '@motogram/shared';

import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { AppModule } from '../app.module';

/**
 * Full App bootstrap needs Postgres+Redis.
 * Varsayilan `pnpm test` (apps/api) `src/contract` altini atlar; suite
 * `describeContract` ile yalnizca `CONTRACT_TESTS=1` iken calisir.
 * Yerel/CI: `$env:CONTRACT_TESTS='1'; pnpm run test:contract` (apps/api).
 */
const describeContract = process.env.CONTRACT_TESTS === '1' ? describe : describe.skip;

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

describe('Contract: OpenAPI ↔ Zod manifest', () => {
  it('OpenAPI contract refs use same Zod schema names (routes.json ↔ openapi.json)', () => {
    const openapiPath = resolve(__dirname, '../../../../docs/openapi.json');
    const routesPath = resolve(__dirname, '../../../../packages/shared/openapi/routes.json');

    const openapi = JSON.parse(readFileSync(openapiPath, 'utf8')) as any;
    const routes = JSON.parse(readFileSync(routesPath, 'utf8')) as RouteRecord[];

    for (const r of routes) {
      const path = toOpenApiPath(r.path);
      const item = openapi.paths?.[path] as any;
      expect(item).toBeDefined();

      const op = item?.[r.method.toLowerCase()];
      expect(op).toBeDefined();

      if (r.requestBodySchema) {
        const ref = op?.requestBody?.content?.['application/json']?.schema?.$ref as string | undefined;
        expect(ref).toBe(`#/components/schemas/${r.requestBodySchema}`);
      }

      const status = String(r.responseStatus ?? 200);
      if (r.responseSchema) {
        const ref = op?.responses?.[status]?.content?.['application/json']?.schema?.$ref as
          | string
          | undefined;
        expect(ref).toBe(`#/components/schemas/${r.responseSchema}`);
      }
    }
  });
});

describeContract('Contract: public HTTP', () => {
  let app: INestApplication;
  /** Bir JWT ile feed / map / media senaryolari (register once, sonra tum istekler). */
  let accessToken!: string;

  const UNKNOWN_MEDIA_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    const suffix = Date.now().toString(36);
    const username = `ct_${suffix}`.slice(0, 30);
    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `ctr9-${suffix}@example.com`,
        username,
        password: 'Contract1!z',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const auth = AuthResultSchema.parse(regRes.body);
    accessToken = auth.tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/livez matches HealthLivezSchema', async () => {
    const res = await request(app.getHttpServer()).get('/v1/livez').expect(200);
    HealthLivezSchema.parse(res.body);
  });

  it('GET /v1/readyz matches HealthReadyzSchema (200 veya 503 gövdesi)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/readyz');
    expect([200, 503]).toContain(res.status);
    HealthReadyzSchema.parse(res.body);
  });

  it('POST /v1/auth/login — gecersiz govde 400 + ApiErrorSchema (ZodBody)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: '', password: '' })
      .expect(400);
    ApiErrorSchema.parse(res.body);
    expect(res.body.error).toBeDefined();
    expect(res.body.code).toBeDefined();
  });

  it('POST /v1/auth/register — EULA olmadan 400 + ApiErrorSchema', async () => {
    const suffix = Date.now().toString(36);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `contract-${suffix}@example.com`,
        username: `cu_${suffix}`,
        password: 'password1',
        eulaAccepted: false,
        preferredLanguage: 'tr',
      })
      .expect(400);
    ApiErrorSchema.parse(res.body);
  });

  it('GET /v1/posts/feed — JWT ile PostFeedPageSchema + likedByMe', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/posts/feed')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const page = PostFeedPageSchema.parse(res.body);
    for (const item of page.items) {
      expect(typeof item.likedByMe).toBe('boolean');
    }
  });

  it('GET /v1/conversations — JWT ile ConversationsListResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    ConversationsListResponseSchema.parse(res.body);
  });

  it('GET /v1/conversations?type=DIRECT — 200 + schema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/conversations')
      .query({ type: 'DIRECT' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = ConversationsListResponseSchema.parse(res.body);
    for (const c of body.conversations) {
      expect(c.type).toBe('DIRECT');
    }
  });

  it('GET /v1/conversations?type=INVALID — 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/conversations')
      .query({ type: 'INVALID' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    ApiErrorSchema.parse(res.body);
  });

  it('GET /v1/map/shards — JWT ile MapShardStatsResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/map/shards')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    MapShardStatsResponseSchema.parse(res.body);
  });

  it('GET /v1/map/nearby — JWT ile NearbyRidersResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/map/nearby')
      .query({ lat: '41.0082', lng: '28.9784' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    NearbyRidersResponseSchema.parse(res.body);
  });

  it('GET /v1/media/:id — Authorization yok 401 + ApiErrorSchema', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/media/${UNKNOWN_MEDIA_UUID}`)
      .expect(401);
    ApiErrorSchema.parse(res.body);
  });

  it('GET /v1/media/:id — bilinmeyen asset 404 + ApiErrorSchema', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/media/${UNKNOWN_MEDIA_UUID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    ApiErrorSchema.parse(res.body);
  });
});
