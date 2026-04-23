/**
 * SOS tam HTTP akisi: olustur (throttle altinda) -> listele -> respond -> resolve.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  AuthResultSchema,
  EmergencyAlertDtoSchema,
  EmergencyAlertsListResponseSchema,
  EmergencyResponderDtoSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

describeE2E('E2E: emergency (SOS) akisi', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let alertId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    const s1 = Date.now().toString(36);
    const s2 = (Date.now() + 3).toString(36);
    const regA = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `sos-a-${s1}@example.com`,
        username: `sos_a_${s1}`.slice(0, 30),
        password: 'SosE2eA1!z',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const a = AuthResultSchema.parse(regA.body);
    userIdA = a.userId;
    tokenA = a.tokens.accessToken;

    const regB = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `sos-b-${s2}@example.com`,
        username: `sos_b_${s2}`.slice(0, 30),
        password: 'SosE2eB1!z',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    tokenB = AuthResultSchema.parse(regB.body).tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('POST /v1/emergency/alerts -> GET list -> respond -> resolve', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/emergency/alerts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'GENERAL',
        latitude: 41.0082,
        longitude: 28.9784,
        holdDurationMs: 3100,
        radiusMeters: 5000,
      })
      .expect(201);
    const created = EmergencyAlertDtoSchema.parse(createRes.body);
    alertId = created.id;
    expect(created.userId).toBe(userIdA);

    const listRes = await request(app.getHttpServer())
      .get('/v1/emergency/alerts')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const list = EmergencyAlertsListResponseSchema.parse(listRes.body);
    expect(list.alerts.some((x: { id: string }) => x.id === alertId)).toBe(true);

    const respRes = await request(app.getHttpServer())
      .post(`/v1/emergency/alerts/${alertId}/respond`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'ACKNOWLEDGED', etaSeconds: 120 })
      .expect(200);
    EmergencyResponderDtoSchema.parse(respRes.body);

    const resolveRes = await request(app.getHttpServer())
      .post(`/v1/emergency/alerts/${alertId}/resolve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ resolution: 'RESOLVED', note: 'e2e ok' })
      .expect(200);
    const resolved = EmergencyAlertDtoSchema.parse(resolveRes.body);
    expect(resolved.status).toBe('RESOLVED');
  }, 60_000);
});
