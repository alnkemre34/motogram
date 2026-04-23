/**
 * Admin RBAC: seed ADMIN/MODERATOR + rapor/ban/yetkisiz 403.
 * Önkoşul: `pnpm run db:seed:test-users` (CI test-all / pipeline).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AdminReportDtoSchema,
  AdminReportsListResponseSchema,
  AdminUserDtoSchema,
  AuthResultSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';
import { PrismaService } from '../modules/prisma/prisma.service';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

const ADMIN_EMAIL = 'admin_seed_e2e@motogram.test';
const ADMIN_PASS = 'AdminE2e1!zz';
const MOD_EMAIL = 'mod_seed_e2e@motogram.test';
const MOD_PASS = 'ModE2e1!zz';

describeE2E('E2E: admin RBAC (seed kullanicilar)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    prisma = app.get(PrismaService);
    const seeded = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!seeded) {
      await app.close();
      throw new Error(
        'RBAC E2E: seed kullanicilar yok. Calistir: cd apps/api && pnpm run db:seed:test-users',
      );
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('ADMIN rapor + MODERATOR ban; USER 403; MODERATOR rol PATCH 403', async () => {
    const seedAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    const seedMod = await prisma.user.findUnique({ where: { email: MOD_EMAIL } });
    expect(seedAdmin?.role).toBe('ADMIN');
    expect(seedMod?.role).toBe('MODERATOR');

    const s = Date.now().toString(36);
    const victimReg = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `rbac-victim-${s}@example.com`,
        username: `rb_v_${s}`.slice(0, 30),
        password: 'RbacE2e1!z',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const victimId = AuthResultSchema.parse(victimReg.body).userId;

    const reporterReg = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `rbac-rep-${s}@example.com`,
        username: `rb_r_${s}`.slice(0, 30),
        password: 'RbacE2e1!z',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const reporterParsed = AuthResultSchema.parse(reporterReg.body);
    const reporterId = reporterParsed.userId;

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetType: 'USER',
        targetId: victimId,
        reason: 'E2E spam',
        status: 'PENDING',
      },
    });

    const adminTok = AuthResultSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ identifier: ADMIN_EMAIL, password: ADMIN_PASS })
          .expect(200)
      ).body,
    ).tokens.accessToken;

    const listRes = await request(app.getHttpServer())
      .get('/v1/admin/reports')
      .set('Authorization', `Bearer ${adminTok}`)
      .expect(200);
    const reports = AdminReportsListResponseSchema.parse(listRes.body);
    expect(reports.some((r: { id: string }) => r.id === report.id)).toBe(true);

    const patchRes = await request(app.getHttpServer())
      .patch(`/v1/admin/reports/${report.id}`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ status: 'RESOLVED', resolutionNote: 'e2e' })
      .expect(200);
    AdminReportDtoSchema.parse(patchRes.body);

    const modTok = AuthResultSchema.parse(
      (
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ identifier: MOD_EMAIL, password: MOD_PASS })
          .expect(200)
      ).body,
    ).tokens.accessToken;

    const banRes = await request(app.getHttpServer())
      .post(`/v1/admin/users/${victimId}/ban`)
      .set('Authorization', `Bearer ${modTok}`)
      .send({ reason: 'e2e ban', shadowOnly: false })
      .expect(201);
    AdminUserDtoSchema.parse(banRes.body);

    await request(app.getHttpServer())
      .delete(`/v1/admin/users/${victimId}/ban`)
      .set('Authorization', `Bearer ${modTok}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/v1/admin/users/${victimId}/role`)
      .set('Authorization', `Bearer ${modTok}`)
      .send({ role: 'USER' })
      .expect(403);

    const plainTok = reporterParsed.tokens.accessToken;
    await request(app.getHttpServer())
      .get('/v1/admin/reports')
      .set('Authorization', `Bearer ${plainTok}`)
      .expect(403);
  }, 120_000);
});
