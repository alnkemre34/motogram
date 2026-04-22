/**
 * @Throttle ile korunan PUT /v1/location/update — saniyede 1 → ikinci istek 429.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthResultSchema } from '@motogram/shared';

import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

describeE2E('E2E: rate limit (429)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    const s = Date.now().toString(36);
    const reg = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `rl-${s}@example.com`,
        username: `rl_${s}`.slice(0, 30),
        password: 'RlE2e1!zz',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    token = AuthResultSchema.parse(reg.body).tokens.accessToken;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('PUT /v1/location/update ikinci istek (1 sn icinde) -> 429', async () => {
    const body = {
      lat: 41.0,
      lng: 29.0,
      clientTimestamp: Date.now(),
    };
    await request(app.getHttpServer())
      .put('/v1/location/update')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(200);

    const second = await request(app.getHttpServer())
      .put('/v1/location/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, clientTimestamp: Date.now() })
      .expect(429);

    expect(second.body?.error).toBe('rate_limited');
  });
});
