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
  type EmergencyNearbyPayload,
  type EmergencyResponderDto,
} from '@motogram/shared';

import { coerceWsOutboundPayload } from '../../common/ws/ws-outbound';
import { TokenService } from '../auth/token.service';
import { MetricsService } from '../metrics/metrics.service';
import { EmergencyService } from './emergency.service';

// Spec 2.3.2 + 3.5 + 9.3 - Acil Durum icin dedicated namespace (/emergency).
// Client connect oldugunda `user:{id}` odasina join olur; server yakindaki SOS
// olayi icin bu oda uzerinden dogru kullaniciya emit eder.

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    userId?: string;
  };
}

@Injectable()
@WebSocketGateway({
  namespace: '/emergency',
  cors: { origin: '*', credentials: false },
})
export class EmergencyGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EmergencyGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly emergency: EmergencyService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    this.emergency.registerGateway({
      broadcastNearby: (recipientIds, payload) => this.broadcastNearby(recipientIds, payload),
      broadcastResponderUpdate: (alertId, requesterId, responder) =>
        this.broadcastResponderUpdate(alertId, requesterId, responder),
      broadcastResolved: (alertId, recipientIds, resolution) =>
        this.broadcastResolved(alertId, recipientIds, resolution),
    });
  }

  afterInit(): void {
    // Namespace zaten /emergency (bu gateway @WebSocketGateway namespace ile kurulu)
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
        if (payload.typ !== 'access') {
          next(new Error('token_type'));
          return;
        }
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
    this.logger.debug(`emergency_ws_connect user=${userId} sid=${client.id}`);
    void client.join(`user:${userId}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    if (!userId) return;
    this.logger.debug(`emergency_ws_disconnect user=${userId} sid=${client.id}`);
  }

  broadcastNearby(recipientIds: string[], payload: EmergencyNearbyPayload): void {
    for (const id of recipientIds) {
      this.server
        .to(`user:${id}`)
        .emit(WS_EVENTS.emergencyNearby, coerceWsOutboundPayload(WS_EVENTS.emergencyNearby, payload, this.metrics));
    }
  }

  broadcastResponderUpdate(
    _alertId: string,
    requesterId: string,
    responder: EmergencyResponderDto,
  ): void {
    const responderPayload = {
      alertId: responder.alertId,
      responderId: responder.responderId,
      status: responder.status,
      etaSeconds: responder.etaSeconds,
      updatedAt: new Date().toISOString(),
    };
    this.server
      .to(`user:${requesterId}`)
      .emit(
        WS_EVENTS.emergencyResponderUpdated,
        coerceWsOutboundPayload(WS_EVENTS.emergencyResponderUpdated, responderPayload, this.metrics),
      );
  }

  broadcastResolved(
    alertId: string,
    recipientIds: string[],
    resolution: 'RESOLVED' | 'CANCELLED' | 'FALSE_ALARM',
  ): void {
    const payload = {
      alertId,
      resolution,
      resolvedAt: new Date().toISOString(),
    };
    for (const id of recipientIds) {
      this.server
        .to(`user:${id}`)
        .emit(
          WS_EVENTS.emergencyResolved,
          coerceWsOutboundPayload(WS_EVENTS.emergencyResolved, payload, this.metrics),
        );
    }
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
      this.logger.warn(`emergency_gateway_shutdown ${(e as Error).message}`);
    }
  }
}
