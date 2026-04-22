/**
 * Internal fanout HMAC: gecersiz imza, eski zaman damgasi, nonce tekrari -> 401.
 */
import { createHmac, randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

describeE2E('E2E: internal fanout guvenlik', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('gecersiz imza -> 401', async () => {
    const secret = process.env.INTERNAL_API_SHARED_SECRET ?? '';
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const body = { userId: randomUUID(), event: 'x', data: {} };
    const ts = String(Date.now());
    const nonce = randomUUID();
    const bodyStr = JSON.stringify(body);
    const badSig = createHmac('sha256', secret).update(`wrong.${nonce}.${bodyStr}`).digest('hex');

    await request(app.getHttpServer())
      .post('/v1/internal/fanout')
      .set({
        'content-type': 'application/json',
        'x-internal-ts': ts,
        'x-internal-nonce': nonce,
        'x-internal-sig': badSig,
      })
      .send(body)
      .expect(401);
  });

  it('eski zaman damgasi -> 401', async () => {
    const secret = process.env.INTERNAL_API_SHARED_SECRET ?? '';
    const body = { userId: randomUUID(), event: 'x', data: {} };
    const ts = String(Date.now() - 60_000);
    const nonce = randomUUID();
    const bodyStr = JSON.stringify(body);
    const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${bodyStr}`).digest('hex');

    await request(app.getHttpServer())
      .post('/v1/internal/fanout')
      .set({
        'content-type': 'application/json',
        'x-internal-ts': ts,
        'x-internal-nonce': nonce,
        'x-internal-sig': sig,
      })
      .send(body)
      .expect(401);
  });

  it('aynı nonce tekrari -> ilk 200, ikinci 401', async () => {
    const secret = process.env.INTERNAL_API_SHARED_SECRET ?? '';
    const body = { userId: randomUUID(), event: 'replay', data: { n: 1 } };
    const ts = String(Date.now());
    const nonce = randomUUID();
    const bodyStr = JSON.stringify(body);
    const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${bodyStr}`).digest('hex');
    const headers = {
      'content-type': 'application/json',
      'x-internal-ts': ts,
      'x-internal-nonce': nonce,
      'x-internal-sig': sig,
    };

    await request(app.getHttpServer()).post('/v1/internal/fanout').set(headers).send(body).expect(200);

    await request(app.getHttpServer()).post('/v1/internal/fanout').set(headers).send(body).expect(401);
  });
});
