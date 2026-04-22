import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  type MessageDto,
  type ReactMessageDto,
  type SendMessageDto,
} from '@motogram/shared';
import { Prisma } from '@prisma/client';
import type { Message, MessageReaction } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.service';
import type { Redis as RedisClient } from 'ioredis';
import { Inject } from '@nestjs/common';

import { ConversationService } from './conversation.service';

// Spec 2.5 / 3.5 / 7.2.2 / 8.7.1 - MessageService.
// - Block kontrolu (hem DM hem ChatRoom). Engelli -> 403.
// - Rate limit: dakikada 60 mesaj (Spec 8.7.1).
// - Idempotent clientId (conversationId + clientId unique).
// - Soft delete (isDeleted).
// - Reaksiyonlar MessageReaction.

const MSG_RATE_LIMIT = 60; // Spec 8.7.1
const MSG_RATE_WINDOW_SECS = 60;

export interface MessageServiceDeps {
  onMessagePersisted?: (params: {
    message: MessageDto;
    recipientIds: string[];
  }) => Promise<void> | void;
  onReactionUpdated?: (params: {
    conversationId: string;
    message: MessageDto;
    reaction: { messageId: string; userId: string; emoji: string; createdAt: string };
    removed: boolean;
    recipientIds: string[];
  }) => Promise<void> | void;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private callbacks: MessageServiceDeps = {};

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly conversations: ConversationService,
  ) {}

  registerCallbacks(cb: MessageServiceDeps): void {
    this.callbacks = cb;
  }

  async send(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<{ message: MessageDto; recipientIds: string[]; duplicate: boolean }> {
    // Spec 7.2.2 - Engelleme: DM'de participant kismeti blocklanmissa 403
    const participant = await this.conversations.assertParticipant(dto.conversationId, senderId);

    // Spec 8.7.1 - mesaj rate limit (dakikada 60)
    const rateOk = await this.enforceRate(senderId);
    if (!rateOk) {
      throw new ForbiddenException({
        error: 'Too many messages, slow down',
        code: ErrorCodes.RATE_LIMITED,
      });
    }

    // DM icin karsi taraf block kontrolu
    const partner = await this.conversations.getDirectPartner(dto.conversationId, senderId);
    if (partner) {
      const block = await this.prisma.block.findFirst({
        where: {
          OR: [
            { initiatorId: senderId, targetId: partner },
            { initiatorId: partner, targetId: senderId },
          ],
        },
      });
      if (block) {
        throw new ForbiddenException({
          error: 'Cannot send message to blocked user',
          code: ErrorCodes.BLOCKED,
        });
      }
    }

    // Idempotent: (conversationId, clientId) unique index. Duplicate -> eski mesaji dondur.
    const existing = await this.prisma.message.findUnique({
      where: {
        conversationId_clientId: {
          conversationId: dto.conversationId,
          clientId: dto.clientId,
        },
      },
      include: { reactions: true },
    });
    if (existing) {
      const recipientIds = (await this.conversations.listParticipantIds(dto.conversationId)).filter(
        (u) => u !== senderId,
      );
      return {
        message: this.toDto(existing, existing.reactions),
        recipientIds,
        duplicate: true,
      };
    }

    const inviteData =
      dto.rideInvite ?? dto.eventInvite ?? undefined;

    const created = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId,
          clientId: dto.clientId,
          content: dto.content,
          mediaUrls: dto.mediaUrls,
          messageType: dto.messageType,
          inviteData: inviteData ? (inviteData as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
        include: { reactions: true },
      });
      await tx.conversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: msg.createdAt },
      });
      return msg;
    });

    const participantIds = await this.conversations.listParticipantIds(dto.conversationId);
    const recipientIds = participantIds.filter((u) => u !== senderId);
    const messageDto = this.toDto(created, created.reactions);

    // Sender'in lastReadAt'i kendi mesajina kadar guncellenir (sanki okudu)
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId: dto.conversationId, userId: senderId },
      },
      data: { lastReadAt: created.createdAt },
    });
    void participant;

    await this.callbacks.onMessagePersisted?.({
      message: messageDto,
      recipientIds,
    });

    return { message: messageDto, recipientIds, duplicate: false };
  }

  async react(
    userId: string,
    dto: ReactMessageDto,
  ): Promise<{
    removed: boolean;
    reaction: { messageId: string; userId: string; emoji: string; createdAt: string };
    conversationId: string;
    message: MessageDto;
    recipientIds: string[];
  }> {
    const message = await this.prisma.message.findUnique({
      where: { id: dto.messageId },
      include: { reactions: true },
    });
    if (!message) {
      throw new NotFoundException({
        error: 'Message not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    await this.conversations.assertParticipant(message.conversationId, userId);

    let removed = false;
    let createdAt = new Date();
    if (dto.remove) {
      try {
        await this.prisma.messageReaction.delete({
          where: {
            messageId_userId_emoji: {
              messageId: dto.messageId,
              userId,
              emoji: dto.emoji,
            },
          },
        });
        removed = true;
      } catch {
        removed = true; // idempotent: yoksa no-op
      }
    } else {
      const upserted = await this.prisma.messageReaction.upsert({
        where: {
          messageId_userId_emoji: {
            messageId: dto.messageId,
            userId,
            emoji: dto.emoji,
          },
        },
        create: { messageId: dto.messageId, userId, emoji: dto.emoji },
        update: {},
      });
      createdAt = upserted.createdAt;
    }

    const refreshed = await this.prisma.message.findUniqueOrThrow({
      where: { id: dto.messageId },
      include: { reactions: true },
    });
    const participantIds = await this.conversations.listParticipantIds(message.conversationId);
    const recipientIds = participantIds.filter((u) => u !== userId);
    const reaction = {
      messageId: dto.messageId,
      userId,
      emoji: dto.emoji,
      createdAt: createdAt.toISOString(),
    };
    const dtoMessage = this.toDto(refreshed, refreshed.reactions);

    await this.callbacks.onReactionUpdated?.({
      conversationId: message.conversationId,
      message: dtoMessage,
      reaction,
      removed,
      recipientIds,
    });

    return {
      removed,
      reaction,
      conversationId: message.conversationId,
      message: dtoMessage,
      recipientIds,
    };
  }

  async softDelete(userId: string, messageId: string): Promise<MessageDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { reactions: true },
    });
    if (!message) {
      throw new NotFoundException({
        error: 'Message not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException({
        error: 'Only sender can delete',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: null, mediaUrls: [], inviteData: Prisma.JsonNull },
      include: { reactions: true },
    });
    return this.toDto(updated, updated.reactions);
  }

  async listMessages(
    userId: string,
    conversationId: string,
    cursor: string | null,
    limit: number,
  ): Promise<{ items: MessageDto[]; nextCursor: string | null }> {
    await this.conversations.assertParticipant(conversationId, userId);
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { reactions: true },
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    return {
      items: page.map((m) => this.toDto(m, m.reactions)).reverse(),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  validateContent(dto: SendMessageDto): void {
    const hasText = Boolean(dto.content && dto.content.trim().length > 0);
    const hasMedia = dto.mediaUrls.length > 0;
    const hasInvite = Boolean(dto.rideInvite ?? dto.eventInvite);
    if (!hasText && !hasMedia && !hasInvite) {
      throw new BadRequestException({
        error: 'Message must carry text, media, or invite',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
  }

  // ============ yardimci ============

  private async enforceRate(userId: string): Promise<boolean> {
    const key = `rate:msg:${userId}`;
    const cur = await this.redis.incr(key);
    if (cur === 1) {
      await this.redis.expire(key, MSG_RATE_WINDOW_SECS);
    }
    if (cur > MSG_RATE_LIMIT) {
      this.logger.warn(`msg_rate_limit user=${userId} cur=${cur}`);
      return false;
    }
    return true;
  }

  private toDto(m: Message, reactions: MessageReaction[]): MessageDto {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      clientId: m.clientId,
      content: m.content,
      mediaUrls: m.mediaUrls,
      messageType: m.messageType,
      inviteData: (m.inviteData as MessageDto['inviteData']) ?? null,
      isDeleted: m.isDeleted,
      createdAt: m.createdAt.toISOString(),
      reactions: reactions.map((r) => ({
        messageId: r.messageId,
        userId: r.userId,
        emoji: r.emoji,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
