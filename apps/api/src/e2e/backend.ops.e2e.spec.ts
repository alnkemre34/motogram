/**
 * Internal fanout imzasi, SOS listesi, gecici ADMIN ile admin okuma uclari.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AdminDashboardSnapshotSchema,
  AdminUsersListResponseSchema,
  AuthResultSchema,
  EmergencyAlertsListResponseSchema,
  OkTrueSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';
import { PrismaService } from '../modules/prisma/prisma.service';
import { internalFanoutHeaders } from './helpers/internal-fanout';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

describeE2E('E2E: internal + emergency + admin okuma', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let username: string;
  let password: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = Date.now().toString(36);
    username = `ops_${suffix}`.slice(0, 30);
    password = 'OpsE2e1!zz';
    const reg = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `ops-${suffix}@example.com`,
        username,
        password,
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const parsed = AuthResultSchema.parse(reg.body);
    userId = parsed.userId;
    accessToken = parsed.tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } }).catch(() => undefined);
    await app?.close();
  });

  it('POST /v1/internal/fanout — imza + nonce (OkTrueSchema)', async () => {
    const secret = process.env.INTERNAL_API_SHARED_SECRET ?? '';
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const body = { userId, event: 'e2e_ping', data: { ok: true } };
    const res = await request(app.getHttpServer())
      .post('/v1/internal/fanout')
      .set(internalFanoutHeaders(body, secret))
      .send(body)
      .expect(200);
    OkTrueSchema.parse(res.body);
  });

  it('GET /v1/emergency/alerts — EmergencyAlertsListResponseSchema', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/emergency/alerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    EmergencyAlertsListResponseSchema.parse(res.body);
  });

  it('admin — DB rol ADMIN, login, snapshot + users, rol USER geri', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: username, password })
      .expect(200);
    const adminAuth = AuthResultSchema.parse(loginRes.body);
    const adminToken = adminAuth.tokens.accessToken;

    const dash = await request(app.getHttpServer())
      .get('/v1/admin/dashboard/snapshot')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    AdminDashboardSnapshotSchema.parse(dash.body);

    const users = await request(app.getHttpServer())
      .get('/v1/admin/users')
      .query({ limit: '5' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    AdminUsersListResponseSchema.parse(users.body);

    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });
});
