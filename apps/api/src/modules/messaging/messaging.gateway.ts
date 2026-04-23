import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
import { Server, Socket } from 'socket.io';
import {
  ErrorCodes,
  EventInviteDataSchema,
  RideInviteDataSchema,
  WS_EVENTS,
  WsConversationJoinSchema,
  WsConversationLeaveSchema,
  WsMessageReactSchema,
  WsMessageReadSchema,
  WsMessageSendSchema,
  WsMessageTypingSchema,
  type EventInviteData,
  type MessageDto,
  type RideInviteData,
  type WsMessageErrorPayload,
} from '@motogram/shared';

import { coerceWsOutboundPayload } from '../../common/ws/ws-outbound';
import { TokenService } from '../auth/token.service';
import { MetricsService } from '../metrics/metrics.service';
import { PushService } from '../push/push.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';

// Spec 2.5 / 3.5 - Mesajlasma WebSocket Gateway.
// Namespace: /messaging (Faz 3 /realtime'dan ayri; tek Server instance, farkli
// namespace -> Redis Adapter zaten Faz 3'te kurulmus oldugu icin cross-instance
// pub/sub otomatik calisir).

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & {
    userId?: string;
    username?: string;
  };
}

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

@Injectable()
@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: '*', credentials: false },
})
export class MessagingGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly conversations: ConversationService,
    private readonly messages: MessageService,
    private readonly push: PushService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (process.env.OPENAPI_GENERATE === '1') {
      return;
    }
    // MessageService'e persist sonrasi broadcast callback'ini ver.
    this.messages.registerCallbacks({
      onMessagePersisted: async ({ message, recipientIds }) => {
        this.broadcastMessage(message, recipientIds);
        // Spec 9.3 - recipientlara push notification (offline olanlar icin)
        if (recipientIds.length > 0) {
          const preview = this.buildPushPreview(message);
          await this.push.sendToUsers(recipientIds, preview).catch((err) => {
            this.logger.warn(`push_enqueue_failed err=${(err as Error).message}`);
          });
        }
      },
      onReactionUpdated: ({ conversationId, message, reaction, removed, recipientIds }) => {
        this.broadcastReaction({
          conversationId,
          messageId: message.id,
          removed,
          reaction,
          recipientIds,
        });
      },
    });
  }

  private buildPushPreview(message: MessageDto) {
    let body = '';
    switch (message.messageType) {
      case 'TEXT':
        body = message.content ?? '';
        break;
      case 'IMAGE':
        body = 'Gorsel gonderdi';
        break;
      case 'VIDEO':
        body = 'Video gonderdi';
        break;
      case 'FILE':
        body = 'Dosya gonderdi';
        break;
      case 'RIDE_INVITE':
        body = 'Rota davetiyesi gonderdi';
        break;
      case 'EVENT_INVITE':
        body = 'Etkinlik davetiyesi gonderdi';
        break;
      default:
        body = 'Yeni mesaj';
    }
    return {
      title: 'Yeni mesaj',
      body: body.slice(0, 140),
      data: {
        type: 'MESSAGE_RECEIVED',
        conversationId: message.conversationId,
        messageId: message.id,
      },
      threadId: message.conversationId,
    };
  }

  afterInit(): void {
    // Namespace zaten /messaging (bu gateway @WebSocketGateway namespace ile kurulu)
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
        (socket as AuthenticatedSocket).data.username = payload.username;
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
    this.logger.debug(`msg_ws_connect user=${userId} sid=${client.id}`);
    void client.join(`user:${userId}`);
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data.userId;
    if (!userId) return;
    this.logger.debug(`msg_ws_disconnect user=${userId} sid=${client.id}`);
  }

  // ================= Client -> Server =================

  @SubscribeMessage(WS_EVENTS.conversationJoin)
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsConversationJoinSchema.safeParse(raw);
    if (!parsed.success) {
      this.emitMessageError(client, this.errorPayload(WS_EVENTS.conversationJoin, 'VALIDATION', parsed.error.message));
      return { ok: false };
    }
    try {
      await this.conversations.assertParticipant(parsed.data.conversationId, userId);
    } catch (err) {
      this.emitMessageError(
        client,
        this.errorPayload(WS_EVENTS.conversationJoin, 'NOT_PARTICIPANT', (err as Error).message),
      );
      return { ok: false };
    }
    await client.join(roomName(parsed.data.conversationId));
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.conversationLeave)
  async handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const parsed = WsConversationLeaveSchema.safeParse(raw);
    if (!parsed.success) {
      this.emitMessageError(
        client,
        this.errorPayload(WS_EVENTS.conversationLeave, 'VALIDATION', parsed.error.message),
      );
      return { ok: false };
    }
    await client.leave(roomName(parsed.data.conversationId));
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.messageSend)
  async handleSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; messageId?: string; duplicate?: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsMessageSendSchema.safeParse(raw);
    if (!parsed.success) {
      this.emitMessageError(
        client,
        this.errorPayload(WS_EVENTS.messageSend, 'VALIDATION', parsed.error.message, (raw as { clientId?: string })?.clientId),
      );
      return { ok: false };
    }
    try {
      let rideInvite: RideInviteData | undefined;
      let eventInvite: EventInviteData | undefined;
      if (parsed.data.messageType === 'RIDE_INVITE' && parsed.data.inviteData) {
        const r = RideInviteDataSchema.safeParse(parsed.data.inviteData);
        if (!r.success) {
          this.emitMessageError(
            client,
            this.errorPayload(WS_EVENTS.messageSend, 'INVALID_INVITE', r.error.message, parsed.data.clientId),
          );
          return { ok: false };
        }
        rideInvite = r.data;
      }
      if (parsed.data.messageType === 'EVENT_INVITE' && parsed.data.inviteData) {
        const r = EventInviteDataSchema.safeParse(parsed.data.inviteData);
        if (!r.success) {
          this.emitMessageError(
            client,
            this.errorPayload(WS_EVENTS.messageSend, 'INVALID_INVITE', r.error.message, parsed.data.clientId),
          );
          return { ok: false };
        }
        eventInvite = r.data;
      }
      const { message, duplicate } = await this.messages.send(userId, {
        conversationId: parsed.data.conversationId,
        clientId: parsed.data.clientId,
        messageType: parsed.data.messageType,
        content: parsed.data.content,
        mediaUrls: parsed.data.mediaUrls,
        rideInvite,
        eventInvite,
      });
      return { ok: true, messageId: message.id, duplicate };
    } catch (err) {
      const e = err as Error & { response?: { code?: number } };
      const code = e.response?.code ?? ErrorCodes.INTERNAL;
      this.emitMessageError(
        client,
        this.errorPayload(WS_EVENTS.messageSend, String(code), e.message, parsed.data.clientId),
      );
      return { ok: false };
    }
  }

  @SubscribeMessage(WS_EVENTS.messageTyping)
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsMessageTypingSchema.safeParse(raw);
    if (!parsed.success) return { ok: false };
    this.server
      .to(roomName(parsed.data.conversationId))
      .except(client.id)
      .emit(
        WS_EVENTS.messageTypingUpdated,
        coerceWsOutboundPayload(
          WS_EVENTS.messageTypingUpdated,
          {
            conversationId: parsed.data.conversationId,
            userId,
            isTyping: parsed.data.isTyping,
          },
          this.metrics,
        ),
      );
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.messageRead)
  async handleRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsMessageReadSchema.safeParse(raw);
    if (!parsed.success) return { ok: false };
    try {
      await this.conversations.markRead(userId, {
        conversationId: parsed.data.conversationId,
        lastReadAt: new Date(parsed.data.readAt),
      });
      this.server
        .to(roomName(parsed.data.conversationId))
        .except(client.id)
        .emit(
          WS_EVENTS.messageReadBy,
          coerceWsOutboundPayload(
            WS_EVENTS.messageReadBy,
            {
              conversationId: parsed.data.conversationId,
              userId,
              readAt: parsed.data.readAt,
            },
            this.metrics,
          ),
        );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  @SubscribeMessage(WS_EVENTS.messageReact)
  async handleReact(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean }> {
    const userId = client.data.userId!;
    const parsed = WsMessageReactSchema.safeParse(raw);
    if (!parsed.success) {
      this.emitMessageError(
        client,
        this.errorPayload(WS_EVENTS.messageReact, 'VALIDATION', parsed.error.message),
      );
      return { ok: false };
    }
    try {
      await this.messages.react(userId, {
        messageId: parsed.data.messageId,
        emoji: parsed.data.emoji,
        remove: parsed.data.remove,
      });
      return { ok: true };
    } catch (err) {
      const e = err as Error & { response?: { code?: number } };
      const code = e.response?.code ?? ErrorCodes.INTERNAL;
      this.emitMessageError(client, this.errorPayload(WS_EVENTS.messageReact, String(code), e.message));
      return { ok: false };
    }
  }

  // ================= Internal broadcasters =================

  broadcastMessage(message: MessageDto, recipientIds: string[]): void {
    const nsp = this.server;
    // Konusma odasindakilere
    nsp.to(roomName(message.conversationId)).emit(
      WS_EVENTS.messageReceived,
      coerceWsOutboundPayload(
        WS_EVENTS.messageReceived,
        { conversationId: message.conversationId, message },
        this.metrics,
      ),
    );
    // Odaya henuz katilmamis kullanicilar icin user:{id} kanalina da gonder
    for (const rid of recipientIds) {
      nsp.to(`user:${rid}`).emit(
        WS_EVENTS.messageReceived,
        coerceWsOutboundPayload(
          WS_EVENTS.messageReceived,
          { conversationId: message.conversationId, message },
          this.metrics,
        ),
      );
    }
  }

  broadcastReaction(params: {
    conversationId: string;
    messageId: string;
    removed: boolean;
    reaction: { messageId: string; userId: string; emoji: string; createdAt: string };
    recipientIds: string[];
  }): void {
    const payload = {
      conversationId: params.conversationId,
      messageId: params.messageId,
      removed: params.removed,
      reaction: params.reaction,
    };
    const nsp = this.server;
    nsp
      .to(roomName(params.conversationId))
      .emit(
        WS_EVENTS.messageReactionUpdated,
        coerceWsOutboundPayload(WS_EVENTS.messageReactionUpdated, payload, this.metrics),
      );
    for (const rid of params.recipientIds) {
      nsp
        .to(`user:${rid}`)
        .emit(
          WS_EVENTS.messageReactionUpdated,
          coerceWsOutboundPayload(WS_EVENTS.messageReactionUpdated, payload, this.metrics),
        );
    }
  }

  broadcastDeleted(conversationId: string, messageId: string, recipientIds: string[]): void {
    const nsp = this.server;
    const payload = { conversationId, messageId };
    nsp
      .to(roomName(conversationId))
      .emit(WS_EVENTS.messageDeleted, coerceWsOutboundPayload(WS_EVENTS.messageDeleted, payload, this.metrics));
    for (const rid of recipientIds) {
      nsp
        .to(`user:${rid}`)
        .emit(WS_EVENTS.messageDeleted, coerceWsOutboundPayload(WS_EVENTS.messageDeleted, payload, this.metrics));
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
      this.logger.warn(`messaging_gateway_shutdown ${(e as Error).message}`);
    }
  }

  // ================= PRIVATE =================

  private emitMessageError(client: Socket, payload: WsMessageErrorPayload): void {
    client.emit(
      WS_EVENTS.messageError,
      coerceWsOutboundPayload(WS_EVENTS.messageError, payload, this.metrics),
    );
  }

  private errorPayload(
    event: string,
    code: string,
    message: string,
    clientId?: string,
  ): WsMessageErrorPayload {
    return { event, code, message, clientId };
  }
}
