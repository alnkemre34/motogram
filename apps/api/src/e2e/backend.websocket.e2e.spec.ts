/**
 * Socket.IO gercek baglanti: /realtime (parti) + /messaging (DM).
 * Iki kullanici; HTTP ile parti + konusma hazirlanir.
 */
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import {
  AuthResultSchema,
  ConversationDetailSchema,
  PartySummarySchema,
  WS_EVENTS,
  WsMessageReceivedSchema,
  WsPartyMemberUpdatedSchema,
  WsPartySignalReceivedSchema,
} from '@motogram/shared';

import { AppModule } from '../app.module';

const describeE2E = process.env.E2E_TESTS === '1' ? describe : describe.skip;

function waitConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket_connect_timeout')), 15_000);
    socket.once('connect', () => {
      clearTimeout(t);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

function emitAck<R>(socket: Socket, ev: string, payload: unknown, ms = 15_000): Promise<R> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack_timeout:${ev}`)), ms);
    socket.emit(ev, payload, (res: R) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

function waitEvent<T>(socket: Socket, event: string, predicate: (p: T) => boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), 15_000);
    const handler = (payload: T) => {
      try {
        if (predicate(payload)) {
          clearTimeout(t);
          socket.off(event, handler as never);
          resolve(payload);
        }
      } catch (e) {
        clearTimeout(t);
        reject(e);
      }
    };
    socket.on(event, handler as never);
  });
}

async function bootListenedApp(): Promise<{
  app: INestApplication;
  baseUrl: string;
}> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const nest = moduleRef.createNestApplication();
  nest.setGlobalPrefix('v1');
  await nest.init();
  const httpServer = nest.getHttpServer() as import('http').Server;
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = httpServer.address() as AddressInfo;
  return { app: nest, baseUrl: `http://127.0.0.1:${addr.port}` };
}

describeE2E('E2E: WebSocket (realtime + messaging)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tokenA: string;
  let tokenB: string;
  let userIdA: string;
  let userIdB: string;
  let partyId: string;
  let conversationId: string;

  beforeAll(async () => {
    ({ app, baseUrl } = await bootListenedApp());
    const s1 = Date.now().toString(36);
    const s2 = (Date.now() + 9).toString(36);

    const regA = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `ws-a-${s1}@example.com`,
        username: `ws_a_${s1}`.slice(0, 30),
        password: 'WsE2eA1!zz',
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
        email: `ws-b-${s2}@example.com`,
        username: `ws_b_${s2}`.slice(0, 30),
        password: 'WsE2eB1!zz',
        eulaAccepted: true,
        preferredLanguage: 'tr',
      })
      .expect(201);
    const b = AuthResultSchema.parse(regB.body);
    userIdB = b.userId;
    tokenB = b.tokens.accessToken;

    const partyRes = await request(app.getHttpServer())
      .post('/v1/parties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'WS E2E', maxMembers: 20 })
      .expect(201);
    const party = PartySummarySchema.parse(partyRes.body);
    partyId = party.id;

    await request(app.getHttpServer())
      .post(`/v1/parties/${partyId}/join`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({})
      .expect(200);

    const convRes = await request(app.getHttpServer())
      .post('/v1/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'DIRECT', userIds: [userIdB] })
      .expect(200);
    const conv = ConversationDetailSchema.parse(convRes.body);
    conversationId = conv.id;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
  });

  it('party:join, update_location, send_signal, leave + message:send, conversation:join', async () => {
    const rtA = io(`${baseUrl}/realtime`, {
      auth: { token: tokenA },
      transports: ['websocket'],
      forceNew: true,
    });
    const rtB = io(`${baseUrl}/realtime`, {
      auth: { token: tokenB },
      transports: ['websocket'],
      forceNew: true,
    });
    const msgA = io(`${baseUrl}/messaging`, {
      auth: { token: tokenA },
      transports: ['websocket'],
      forceNew: true,
    });
    const msgB = io(`${baseUrl}/messaging`, {
      auth: { token: tokenB },
      transports: ['websocket'],
      forceNew: true,
    });

    await Promise.all([waitConnect(rtA), waitConnect(rtB), waitConnect(msgA), waitConnect(msgB)]);

    const ackJoinA = await emitAck<{ ok?: boolean }>(rtA, WS_EVENTS.partyJoin, { partyId });
    const ackJoinB = await emitAck<{ ok?: boolean }>(rtB, WS_EVENTS.partyJoin, { partyId });
    expect(ackJoinA.ok).toBe(true);
    expect(ackJoinB.ok).toBe(true);

    const memberUpdatedP = waitEvent(rtB, WS_EVENTS.partyMemberUpdated, (raw: unknown) => {
      const p = WsPartyMemberUpdatedSchema.safeParse(raw);
      return p.success && p.data.userId === userIdA && p.data.partyId === partyId;
    });

    const ts = Date.now();
    rtA.emit(
      WS_EVENTS.partyUpdateLocation,
      {
        partyId,
        lat: 41.02,
        lng: 29.01,
        clientTimestamp: ts,
      },
      () => undefined,
    );

    const mu = await memberUpdatedP;
    WsPartyMemberUpdatedSchema.parse(mu);

    const signalP = waitEvent(rtB, WS_EVENTS.partySignalReceived, (raw: unknown) => {
      const p = WsPartySignalReceivedSchema.safeParse(raw);
      return p.success && p.data.partyId === partyId && p.data.senderId === userIdA;
    });
    rtA.emit(
      WS_EVENTS.partySendSignal,
      { partyId, type: 'REGROUP', clientTimestamp: Date.now() },
      () => undefined,
    );
    const sig = await signalP;
    WsPartySignalReceivedSchema.parse(sig);

    const ackConvA = await emitAck<{ ok?: boolean }>(msgA, WS_EVENTS.conversationJoin, {
      conversationId,
    });
    const ackConvB = await emitAck<{ ok?: boolean }>(msgB, WS_EVENTS.conversationJoin, {
      conversationId,
    });
    expect(ackConvA.ok).toBe(true);
    expect(ackConvB.ok).toBe(true);

    const recvP = waitEvent(msgB, WS_EVENTS.messageReceived, (raw: unknown) => {
      const p = WsMessageReceivedSchema.safeParse(raw);
      return p.success && p.data.conversationId === conversationId;
    });

    const clientMsgId = randomUUID();
    await new Promise<void>((resolve, reject) => {
      msgA.emit(
        WS_EVENTS.messageSend,
        {
          conversationId,
          clientId: clientMsgId,
          messageType: 'TEXT',
          content: 'ws-e2e',
          mediaUrls: [],
          clientTimestamp: Date.now(),
        },
        (ack: unknown) => {
          const ok = ack && typeof ack === 'object' && 'ok' in ack && (ack as { ok: boolean }).ok === true;
          if (ok) resolve();
          else reject(new Error(`message_send_ack ${JSON.stringify(ack)}`));
        },
      );
    });

    const received = await recvP;
    const parsedRecv = WsMessageReceivedSchema.parse(received);
    expect(parsedRecv.message.content).toContain('ws-e2e');

    const leaveB = await emitAck<{ ok?: boolean }>(rtB, WS_EVENTS.partyLeave, { partyId });
    expect(leaveB.ok).toBe(true);

    const leaveA = await emitAck<{ ok?: boolean; ended?: boolean }>(rtA, WS_EVENTS.partyLeave, {
      partyId,
    });
    expect(leaveA.ok).toBe(true);

    rtA.disconnect();
    rtB.disconnect();
    msgA.disconnect();
    msgB.disconnect();
  }, 120_000);
});
