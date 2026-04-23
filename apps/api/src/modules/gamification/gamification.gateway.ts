import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  WS_EVENTS,
  type BadgeDto,
  type QuestCompletedDto,
} from '@motogram/shared';

import { coerceWsOutboundPayload } from '../../common/ws/ws-outbound';
import { TokenService } from '../auth/token.service';
import { MetricsService } from '../metrics/metrics.service';
import { GamificationService } from './gamification.service';

// Spec 3.7 - Quest/Badge tamamlanma client'a toast modali icin WS.

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & { userId?: string };
}

@Injectable()
@WebSocketGateway({ namespace: '/gamification', cors: { origin: '*' } })
export class GamificationGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GamificationGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly service: GamificationService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    this.service.registerGateway({
      broadcastQuestCompleted: (userId, dto, questName) =>
        this.emitQuestCompleted(userId, dto, questName),
      broadcastBadgeEarned: (userId, badge) => this.emitBadgeEarned(userId, badge),
    });
  }

  afterInit(): void {
    // Namespace zaten /gamification (bu gateway @WebSocketGateway namespace ile kurulu)
    this.server.use(async (socket, next) => {
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
        (socket as AuthenticatedSocket).data.userId = payload.sub;
        next();
      } catch (err) {
        next(new Error((err as Error).message || 'auth_failed'));
      }
    });
  }

  handleConnection(client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect(true);
      return;
    }
    void client.join(`user:${userId}`);
  }

  handleDisconnect(_client: AuthenticatedSocket): void {
    // noop
  }

  emitQuestCompleted(userId: string, dto: QuestCompletedDto, questName: string): void {
    const questPayload = {
      questId: dto.questId,
      questCode: dto.questCode,
      questName,
      xpAwarded: dto.xpAwarded,
      newUserLevel: dto.newUserLevel,
      newUserXp: dto.newUserXp,
    };
    this.server
      .to(`user:${userId}`)
      .emit(
        WS_EVENTS.questCompleted,
        coerceWsOutboundPayload(WS_EVENTS.questCompleted, questPayload, this.metrics),
      );
  }

  emitBadgeEarned(userId: string, badge: BadgeDto): void {
    const badgePayload = {
      badgeId: badge.id,
      badgeCode: badge.code,
      badgeName: badge.name,
      iconUrl: badge.iconUrl,
      rarity: badge.rarity,
    };
    this.server
      .to(`user:${userId}`)
      .emit(WS_EVENTS.badgeEarned, coerceWsOutboundPayload(WS_EVENTS.badgeEarned, badgePayload, this.metrics));
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
      this.logger.warn(`gamification_gateway_shutdown ${(e as Error).message}`);
    }
  }
}
