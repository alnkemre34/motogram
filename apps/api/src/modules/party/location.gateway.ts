import { Inject, Injectable, Logger, OnModuleDestroy, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, Socket } from 'socket.io';
import {
  ErrorCodes,
  WS_EVENTS,
  WsPartyJoinSchema,
  WsPartyLeaveSchema,
  WsPartySendSignalSchema,
  WsPartyUpdateLocationSchema,
  type PartyMemberDto,
  type PartySignalType,
  type WsPartyErrorPayload,
  type WsPartyMemberUpdatedPayload,
  type WsPartySignalReceivedPayload,
} from '@motogram/shared';

import { REDIS_CLIENT } from '../redis/redis.service';
import type { Redis as RedisClient } from 'ioredis';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from '../location/location.service';
import { MetricsService } from '../metrics/metrics.service';
import { PartyService, type PartyEmitter } from './party.service';
import { PARTY_REDIS_KEYS } from './party.constants';
import { getServerHostname } from '../../common/config/server-identity';
import { coerceWsOutboundPayload } from '../../common/ws/ws-outbound';

// Spec 3.5 + 4.2 + 8.4 - Socket.IO Gateway.
// - Redis Adapter (pub/sub) multi-instance icin (ECS 4 task -> ayni parti odasi).
// - JWT middleware (handshake.auth.token).
// - Client -> Server: party:join, party:leave, party:update_location, party:send_signal
// - Server -> Client: party:member_*, party:signal_received, party:leader_changed, party:ended

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    userId?: string;
    username?: string;
    city?: string | null;
  };
}

function roomName(partyId: string): string {
  return `party:${partyId}`;
}

@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*', credentials: false },
})
export class LocationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy, PartyEmitter
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(LocationGateway.name);
  private pubClient?: RedisClient;
  private subClient?: RedisClient;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly location: LocationService,
    @Inject(forwardRef(() => PartyService))
    private readonly partyService: PartyService,
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    // Spec 8.4 - Redis Adapter
    if (this.config.get<string>('DISABLE_WS_ADAPTER') !== '1') {
      try {
        this.pubClient = this.redis.duplicate();
        this.subClient = this.redis.duplicate();
        await Promise.all([this.pubClient.connect?.(), this.subClient.connect?.()]);
        server.adapter(createAdapter(this.pubClient, this.subClient));
        this.logger.log('ws_redis_adapter_attached');
      } catch (err) {
        this.logger.warn(
          `ws_redis_adapter_failed: ${(err as Error).message} - running in single-instance mode`,
        );
      }
    }

    // JWT handshake middleware
    server.use(async (socket, next) => {
      try {
        const token =
          (socket.handshake.auth?.token as string | undefined) ??
          (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as
            | string
            | undefined);
        if (!token) {
          next(new Error('unauthorized'));
          return;
        }
        const payload = await this.tokens.verifyAccess(token);
        if (payload.typ !== 'access') {
          next(new Error('token_type'));
          return;
        }
        (socket as AuthenticatedSocket).data.userId = payload.sub;
        (socket as AuthenticatedSocket).data.username = payload.username;
        next();
      } catch (err) {
        next(new Error((err as Error).message || 'auth_failed'));
      }
    });

    // PartyService'a emitter referansini ver
    this.partyService.registerEmitter(this);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.server.emit('server:shutdown', { at: new Date().toISOString() });
      await new Promise((r) => setTimeout(r, 1000));
      this.server.disconnectSockets(true);
      await new Promise<void>((resolve, reject) => {
        this.server.close((err?: Error) => (err ? reject(err) : resolve()));
      });
    } catch (e) {
      this.logger.warn(`ws_party_shutdown ${(e as Error).message}`);
    }
    this.pubClient?.disconnect?.();
    this.subClient?.disconnect?.();
  }

  handleConnection(client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect(true);
      return;
    }
    this.logger.debug(`ws_connect user=${userId} sid=${client.id}`);
    this.metrics.wsConnectionsActive.inc({ namespace: '/realtime/party' });
    // Kullanici kendi odasina otomatik girer (hedefli mesajlar icin)
    void client.join(`user:${userId}`);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = client.data.userId;
    if (!userId) return;
    this.logger.debug(`ws_disconnect user=${userId} sid=${client.id}`);
    this.metrics.wsConnectionsActive.dec({ namespace: '/realtime/party' });
    this.metrics.wsDisconnections.inc({ reason: 'client_disconnect' });
    // Spec 7.3.3 - Socket disconnect olunca user:{id}:status.online=false + parti icinde
    // 60sn zombie watch'a yazilir.
    const activePartyId = await this.redis.get(PARTY_REDIS_KEYS.userParty(userId));
    if (activePartyId) {
      await this.partyService.markOffline(userId, activePartyId);
    }
    // User status (Faz 2 Redis)
    await this.redis.hset(`user:${userId}:status`, 'online', 'false');
  }

  // ================= Client -> Server =================

  @SubscribeMessage(WS_EVENTS.partyJoin)
  async handlePartyJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsPartyJoinSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partyJoin, 'VALIDATION', parsed.error.message),
          this.metrics,
        ),
      );
      return { ok: false };
    }
    const { partyId } = parsed.data;
    const joinStarted = process.hrtime.bigint();
    // Authz: kullanici bu partide (DB'de member) olmali
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_userId: { partyId, userId } },
    });
    if (!member || member.leftAt) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partyJoin, 'NOT_MEMBER', 'not a member'),
          this.metrics,
        ),
      );
      return { ok: false };
    }
    await client.join(roomName(partyId));
    await this.partyService.clearOfflineMark(userId, partyId);
    await this.prisma.partyMember.update({
      where: { partyId_userId: { partyId, userId } },
      data: { serverHostname: getServerHostname() },
    });
    // Online durumunu meta'da isaretle
    await this.redis.sadd(PARTY_REDIS_KEYS.members(partyId), userId);
    const joinNs = process.hrtime.bigint() - joinStarted;
    this.metrics.wsMessageLatency.observe(
      { event: WS_EVENTS.partyJoin },
      Number(joinNs) / 1e9,
    );
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.partyLeave)
  async handlePartyLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; ended: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsPartyLeaveSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partyLeave, 'VALIDATION', parsed.error.message),
          this.metrics,
        ),
      );
      return { ok: false, ended: false };
    }
    try {
      const result = await this.partyService.leaveParty(userId, parsed.data.partyId, 'LEFT');
      await client.leave(roomName(parsed.data.partyId));
      return { ok: true, ended: result.ended };
    } catch (err) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partyLeave, 'FAIL', (err as Error).message),
          this.metrics,
        ),
      );
      return { ok: false, ended: false };
    }
  }

  @SubscribeMessage(WS_EVENTS.partyUpdateLocation)
  async handlePartyUpdateLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsPartyUpdateLocationSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partyUpdateLocation, 'VALIDATION', parsed.error.message),
          this.metrics,
        ),
      );
      return { ok: false };
    }
    const dto = parsed.data;
    // Membership check (Spec 5.1 + 7.3.1)
    const isMember = await this.redis.sismember(PARTY_REDIS_KEYS.members(dto.partyId), userId);
    if (!isMember) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partyUpdateLocation, 'NOT_MEMBER', 'not a member'),
          this.metrics,
        ),
      );
      return { ok: false };
    }

    // Spec 3.3 + 5.1 - LocationService uzerinden Redis GEO + status. Parti icindeyken
    // privacyMode=OFF olsa bile parti uyeleri gorur (service canViewBasedOnPrivacy bypass).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { city: true, locationSharing: true, isBanned: true },
    });
    if (!user || user.isBanned) return { ok: false };

    await this.location.updateLocation(
      userId,
      {
        lat: dto.lat,
        lng: dto.lng,
        heading: dto.heading,
        speed: dto.speed,
        accuracy: dto.accuracy,
        batteryLevel: dto.batteryLevel,
        partyId: dto.partyId,
        source: 'PARTY',
        clientTimestamp: dto.clientTimestamp,
      },
      user,
    );

    // Broadcast (Spec 3.5)
    const payload: WsPartyMemberUpdatedPayload = {
      partyId: dto.partyId,
      userId,
      lat: dto.lat,
      lng: dto.lng,
      heading: dto.heading ?? null,
      speed: dto.speed ?? null,
      timestamp: Date.now(),
    };
    this.server
      .to(roomName(dto.partyId))
      .except(client.id)
      .emit(
        WS_EVENTS.partyMemberUpdated,
        coerceWsOutboundPayload(WS_EVENTS.partyMemberUpdated, payload, this.metrics),
      );
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.partySendSignal)
  async handleSendSignal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; rateLimited?: boolean }> {
    const userId = client.data.userId!;
    const username = client.data.username ?? '';
    const parsed = WsPartySendSignalSchema.safeParse(raw);
    if (!parsed.success) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partySendSignal, 'VALIDATION', parsed.error.message),
          this.metrics,
        ),
      );
      return { ok: false };
    }
    try {
      const result = await this.partyService.recordSignal(
        parsed.data.partyId,
        userId,
        parsed.data.type,
        username,
      );
      if (!result.allowed) {
        client.emit(
          WS_EVENTS.partyError,
          coerceWsOutboundPayload(
            WS_EVENTS.partyError,
            this.errorPayload(WS_EVENTS.partySendSignal, String(ErrorCodes.RATE_LIMITED), 'rate_limited'),
            this.metrics,
          ),
        );
        return { ok: false, rateLimited: true };
      }
      return { ok: true };
    } catch (err) {
      client.emit(
        WS_EVENTS.partyError,
        coerceWsOutboundPayload(
          WS_EVENTS.partyError,
          this.errorPayload(WS_EVENTS.partySendSignal, 'FAIL', (err as Error).message),
          this.metrics,
        ),
      );
      return { ok: false };
    }
  }

  // ================= PartyEmitter (PartyService tarafindan kullanilir) =================
  emitMemberJoined(partyId: string, member: PartyMemberDto): void {
    this.server
      .to(roomName(partyId))
      .emit(
        WS_EVENTS.partyMemberJoined,
        coerceWsOutboundPayload(WS_EVENTS.partyMemberJoined, { partyId, member }, this.metrics),
      );
  }

  emitMemberLeft(partyId: string, userId: string, reason: 'LEFT' | 'DISCONNECT_TIMEOUT' | 'KICKED'): void {
    this.server
      .to(roomName(partyId))
      .emit(
        WS_EVENTS.partyMemberLeft,
        coerceWsOutboundPayload(WS_EVENTS.partyMemberLeft, { partyId, userId, reason }, this.metrics),
      );
  }

  emitStatusChanged(partyId: string, status: 'WAITING' | 'RIDING' | 'PAUSED' | 'ENDED'): void {
    this.server
      .to(roomName(partyId))
      .emit(
        WS_EVENTS.partyStatusChanged,
        coerceWsOutboundPayload(WS_EVENTS.partyStatusChanged, { partyId, status }, this.metrics),
      );
  }

  emitLeaderChanged(
    partyId: string,
    newLeaderId: string,
    reason: 'LEADER_LEFT' | 'LEADER_OFFLINE' | 'MANUAL',
  ): void {
    this.server.to(roomName(partyId)).emit(
      WS_EVENTS.partyLeaderChanged,
      coerceWsOutboundPayload(WS_EVENTS.partyLeaderChanged, { partyId, newLeaderId, reason }, this.metrics),
    );
  }

  emitSignal(
    partyId: string,
    payload: { type: PartySignalType; senderId: string; senderName: string; timestamp: number },
  ): void {
    // Spec 7.3.1 - sadece odaya yayin; hicbir yere yazilmaz.
    const out: WsPartySignalReceivedPayload = {
      partyId,
      type: payload.type,
      senderId: payload.senderId,
      senderName: payload.senderName,
      timestamp: payload.timestamp,
    };
    this.server
      .to(roomName(partyId))
      .emit(WS_EVENTS.partySignalReceived, coerceWsOutboundPayload(WS_EVENTS.partySignalReceived, out, this.metrics));
  }

  emitEnded(partyId: string, reason: 'LEADER_LEFT_ALONE' | 'MANUAL' | 'TIMEOUT'): void {
    this.server
      .to(roomName(partyId))
      .emit(
        WS_EVENTS.partyEnded,
        coerceWsOutboundPayload(WS_EVENTS.partyEnded, { partyId, reason }, this.metrics),
      );
  }

  /** Internal fanout (multi-replica): emit to all sockets in `user:{id}` room. */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, coerceWsOutboundPayload(event, data, this.metrics));
  }

  // ================= PRIVATE =================
  private errorPayload(event: string, code: string, message: string): WsPartyErrorPayload {
    return { event, code, message };
  }
}
