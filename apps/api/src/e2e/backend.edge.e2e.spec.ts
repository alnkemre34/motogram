/**
 * Edge-to-edge (tam yigin) backend dogrulama: gercek Nest AppModule + Postgres + Redis.
 * Auth → post CRUD → parti olustur / listele / ayril → metrik scrape zinciri.
 *
 * Calistirma: `E2E_TESTS=1` + migrate uygulanmis DB + REDIS_URL (CI ile ayni env).
 * Varsayilan `pnpm test` bu klasoru atlar; `pnpm run test:e2e` (apps/api).
 * Genis modul yuzeyi: `backend.surface.e2e.spec.ts` (ayni `E2E_TESTS=1` ile birlikte kosar).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AuthResultSchema,
  HealthLivezSchema,
  HealthReadyzSchema,
  MapShardStatsResponseSchema,
  NearbyPartiesResponseSchema,
  NearbyRidersResponseSchema,
  PartyDetailSchema,
  PartyLeaveHttpResponseSchema,
  PartySummarySchema,
  PostApiResponseSchema,
  PostDeleteResponseSchema,
  PostFeedPageSchema,
  TokenPairResponseSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

describeE2E('E2E: backend edge-to-edge', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;
  let userEmail: string;
  const userPassword = 'E2eEdge1!z';
  let postId: string;
  let partyId: string;

  beforeAll(async () => {
    try {
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('v1');
      await app.init();
    } catch (e: unknown) {
      const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
      if (text.includes("Can't reach database server") || text.includes('PrismaClientInitializationError')) {
        throw new Error(
          [
            'E2E: PostgreSQL\'e baglanilamiyor (genelde localhost:5432 ayakta degil veya DATABASE_URL yanlis).',
            '',
            'Cozum — repo kokunden CI ile ayni stack:',
            '  pnpm run e2e:stack:up',
            '  cd apps/api; pnpm run test:e2e:migrate',
            '  $env:E2E_TESTS=\'1\'; pnpm run test:e2e',
            '',
            'Not: docker-compose.dev.yml sifresi farklidir (motogram_dev_password / motogram).',
            'E2E icin docker-compose.e2e.yml kullanin veya DATABASE_URL\'i jest-env ile eslestirin.',
          ].join('\n'),
          { cause: e },
        );
      }
      throw e;
    }

    const suffix = Date.now().toString(36);
    userEmail = `e2e-${suffix}@example.com`;
    const username = `e2e_${suffix}`.slice(0, 30);

    const regRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: userEmail,
        username,
        password: userPassword,
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const reg = AuthResultSchema.parse(regRes.body);
    userId = reg.userId;
    accessToken = reg.tokens.accessToken;
    refreshToken = reg.tokens.refreshToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/livez — 200 + HealthLivezSchema', async () => {
    const res = await request(app.getHttpServer()).get('/v1/livez').expect(200);
    HealthLivezSchema.parse(res.body);
  });

  it('GET /v1/readyz — 200 (tam bagimliliklar ayakta)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/readyz').expect(200);
    HealthReadyzSchema.parse(res.body);
  });

  it('POST /v1/auth/login — email ile giris + AuthResultSchema', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: userEmail, password: userPassword })
      .expect(200);
    const parsed = AuthResultSchema.parse(res.body);
    expect(parsed.userId).toBe(userId);
    accessToken = parsed.tokens.accessToken;
    refreshToken = parsed.tokens.refreshToken;
  });

  it('POST /v1/auth/refresh — TokenPairResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const pair = TokenPairResponseSchema.parse(res.body);
    expect(pair.accessToken.length).toBeGreaterThan(20);
    accessToken = pair.accessToken;
    refreshToken = pair.refreshToken;
  });

  it('POST /v1/posts — olustur + PostApiResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        caption: 'e2e edge',
        mediaUrls: ['https://example.com/e2e-media.jpg'],
        mediaType: 'IMAGE',
        latitude: 41.0082,
        longitude: 28.9784,
        locationName: 'Istanbul',
        hashtags: ['e2e'],
        mentionedUserIds: [],
      })
      .expect(201);
    const post = PostApiResponseSchema.parse(res.body);
    postId = post.id;
    expect(post.userId).toBe(userId);
    expect(post.likedByMe).toBe(false);
  });

  it('GET /v1/posts/:id — tek post + PostApiResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const post = PostApiResponseSchema.parse(res.body);
    expect(post.id).toBe(postId);
    expect(typeof post.likedByMe).toBe('boolean');
  });

  it('GET /v1/posts/feed — yeni post listede + PostFeedPageSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/posts/feed')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const page = PostFeedPageSchema.parse(res.body);
    expect(page.items.some((p: { id: string }) => p.id === postId)).toBe(true);
    const mine = page.items.find((p: { id: string }) => p.id === postId);
    expect(mine?.likedByMe).toBe(false);
  });

  it('PATCH /v1/posts/:id — guncelle + PostApiResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ caption: 'e2e edge updated' })
      .expect(200);
    const post = PostApiResponseSchema.parse(res.body);
    expect(post.caption).toBe('e2e edge updated');
  });

  it('GET /v1/map/shards + /v1/map/nearby — harita uclari', async () => {
    const shards = await request(app.getHttpServer())
      .get('/v1/map/shards')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    MapShardStatsResponseSchema.parse(shards.body);

    const nearby = await request(app.getHttpServer())
      .get('/v1/map/nearby')
      .query({ lat: '41.0082', lng: '28.9784' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    NearbyRidersResponseSchema.parse(nearby.body);
  });

  it('POST /v1/parties — public parti + PartySummarySchema', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/parties')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `E2E ${Date.now()}`,
        isPrivate: false,
        maxMembers: 10,
      })
      .expect(201);
    const summary = PartySummarySchema.parse(res.body);
    partyId = summary.id;
    expect(summary.leaderId).toBe(userId);
    expect(summary.isPrivate).toBe(false);
  });

  it('GET /v1/parties/:id — PartyDetailSchema', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/parties/${partyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const detail = PartyDetailSchema.parse(res.body);
    expect(detail.id).toBe(partyId);
    expect(detail.members.some((m: { userId: string }) => m.userId === userId)).toBe(true);
  });

  it('GET /v1/parties — nearby + NearbyPartiesResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/parties')
      .query({ lat: '41.0082', lng: '28.9784', limit: '20' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = NearbyPartiesResponseSchema.parse(res.body);
    expect(body.parties.some((p: { id: string }) => p.id === partyId)).toBe(true);
  });

  it('POST /v1/parties/:id/leave — lider tek basina + PartyLeaveHttpResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/parties/${partyId}/leave`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const left = PartyLeaveHttpResponseSchema.parse(res.body);
    expect(left.ended).toBe(true);
  });

  it('GET /v1/metrics — Prometheus metin govdesi', async () => {
    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(50);
    expect(res.text).toMatch(/# (HELP|TYPE)/);
  });

  it('DELETE /v1/posts/:id — PostDeleteResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    PostDeleteResponseSchema.parse(res.body);
  });

  it('POST /v1/auth/logout — 204', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ allDevices: false, refreshToken })
      .expect(204);
  });
});
