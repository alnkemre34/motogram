import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorCodes,
  type ConversationDetail,
  type ConversationPreview,
  type CreateConversationDto,
  type ListConversationsQueryDto,
  type MarkReadDto,
  type MessageDto,
  type MuteConversationDto,
} from '@motogram/shared';
import type {
  Conversation,
  ConversationParticipant,
  ConversationType as PrismaConversationType,
  Message,
  MessageReaction,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

// Spec 2.5 / 3.2 - Conversation (DM + grup + topluluk sohbet).
// Ozel kurallar:
//  - DIRECT conversation: iki taraf arasinda tek bir kayit (findOrCreate).
//  - GROUP_CHAT: createdById var + name opsiyonel + >=3 katilimci.
//  - COMMUNITY_CHAT: Community icinde tek adet; herkes otomatik katilimci.

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateDirect(userAId: string, userBId: string): Promise<ConversationDetail> {
    if (userAId === userBId) {
      throw new BadRequestException({
        error: 'Cannot DM yourself',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    await this.assertNotBlocked(userAId, userBId);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        deletedAt: null,
        AND: [
          { participants: { some: { userId: userAId, leftAt: null } } },
          { participants: { some: { userId: userBId, leftAt: null } } },
        ],
      },
      include: { participants: { include: { user: true } } },
    });
    if (existing) {
      return this.toDetail(existing);
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        createdById: userAId,
        participants: {
          create: [
            { userId: userAId },
            { userId: userBId },
          ],
        },
      },
      include: { participants: { include: { user: true } } },
    });
    return this.toDetail(created);
  }

  async createConversation(
    creatorId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationDetail> {
    if (dto.type === 'DIRECT') {
      const target = dto.userIds[0];
      if (!target) {
        throw new BadRequestException({
          error: 'DIRECT conversation requires target user',
          code: ErrorCodes.VALIDATION_FAILED,
        });
      }
      return this.findOrCreateDirect(creatorId, target);
    }
    if (dto.type === 'COMMUNITY_CHAT') {
      if (!dto.communityId) {
        throw new BadRequestException({
          error: 'COMMUNITY_CHAT requires communityId',
          code: ErrorCodes.VALIDATION_FAILED,
        });
      }
      // Topluluk sohbeti: yetki kontrolu + tek adet kayit
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: dto.communityId, userId: creatorId } },
      });
      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException({
          error: 'Must be active community member',
          code: ErrorCodes.FORBIDDEN,
        });
      }
      const existing = await this.prisma.conversation.findFirst({
        where: { communityId: dto.communityId, type: 'COMMUNITY_CHAT', deletedAt: null },
        include: { participants: { include: { user: true } } },
      });
      if (existing) return this.toDetail(existing);
      const created = await this.prisma.conversation.create({
        data: {
          type: 'COMMUNITY_CHAT',
          communityId: dto.communityId,
          name: dto.name,
          createdById: creatorId,
          participants: { create: [{ userId: creatorId }] },
        },
        include: { participants: { include: { user: true } } },
      });
      return this.toDetail(created);
    }
    // GROUP_CHAT
    const participantIds = Array.from(new Set([...dto.userIds, creatorId]));
    if (participantIds.length < 3) {
      throw new BadRequestException({
        error: 'GROUP_CHAT requires at least 3 participants',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    const created = await this.prisma.conversation.create({
      data: {
        type: 'GROUP_CHAT',
        name: dto.name,
        createdById: creatorId,
        participants: { create: participantIds.map((id) => ({ userId: id })) },
      },
      include: { participants: { include: { user: true } } },
    });
    return this.toDetail(created);
  }

  async listMyConversations(
    userId: string,
    query?: ListConversationsQueryDto,
  ): Promise<ConversationPreview[]> {
    const memberships = await this.prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
        conversation: {
          deletedAt: null,
          ...(query?.type ? { type: query.type } : {}),
        },
      },
      include: {
        conversation: {
          include: {
            participants: { include: { user: true } },
            messages: {
              where: { isDeleted: false },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { reactions: true },
            },
          },
        },
      },
      orderBy: [{ conversation: { lastMessageAt: 'desc' } }, { joinedAt: 'desc' }],
    });

    const previews: ConversationPreview[] = [];
    for (const m of memberships) {
      const conv = m.conversation;
      const otherParticipant =
        conv.type === 'DIRECT'
          ? conv.participants.find((p) => p.userId !== userId)
          : null;
      const last = conv.messages[0];
      const unreadCount = await this.prisma.message.count({
        where: {
          conversationId: conv.id,
          isDeleted: false,
          senderId: { not: userId },
          createdAt: m.lastReadAt
            ? { gt: m.lastReadAt }
            : undefined,
        },
      });
      previews.push({
        id: conv.id,
        type: conv.type,
        name: conv.name ?? null,
        avatarUrl: conv.avatarUrl ?? null,
        communityId: conv.communityId ?? null,
        otherUserId: otherParticipant?.userId ?? null,
        otherUsername: otherParticipant?.user.username ?? null,
        otherAvatarUrl: otherParticipant?.user.avatarUrl ?? null,
        lastMessage: last ? this.toMessageDto(last, last.reactions) : null,
        unreadCount,
        lastReadAt: m.lastReadAt?.toISOString() ?? null,
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      });
    }
    return previews;
  }

  async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException({
        error: 'Not a participant',
        code: ErrorCodes.FORBIDDEN,
      });
    }
    return participant;
  }

  async getDetail(conversationId: string, viewerId: string): Promise<ConversationDetail> {
    await this.assertParticipant(conversationId, viewerId);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: { participants: { include: { user: true } } },
    });
    if (!conv) {
      throw new NotFoundException({
        error: 'Conversation not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    return this.toDetail(conv);
  }

  async markRead(userId: string, dto: MarkReadDto): Promise<void> {
    await this.assertParticipant(dto.conversationId, userId);
    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: { conversationId: dto.conversationId, userId },
      },
      data: { lastReadAt: dto.lastReadAt ?? new Date() },
    });
  }

  async listParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** B-18 — Push için: `mutedUntil > now` veya `isMuted` alıcılar çıkarılır. */
  async filterPushRecipients(conversationId: string, recipientIds: string[]): Promise<string[]> {
    if (recipientIds.length === 0) return [];
    const now = new Date();
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { in: recipientIds } },
      select: { userId: true, isMuted: true, mutedUntil: true },
    });
    return recipientIds.filter((id) => {
      const p = rows.find((r) => r.userId === id);
      if (!p) return false;
      const muted =
        p.isMuted || (p.mutedUntil !== null && p.mutedUntil !== undefined && p.mutedUntil > now);
      return !muted;
    });
  }

  /** B-18 — Sessiz / sessiz kaldır. */
  async muteConversation(
    userId: string,
    conversationId: string,
    dto: MuteConversationDto,
  ): Promise<void> {
    await this.assertParticipant(conversationId, userId);
    if (dto.mutedUntil === null) {
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { isMuted: false, mutedUntil: null },
      });
      return;
    }
    if (dto.mutedUntil !== undefined) {
      const until = new Date(dto.mutedUntil);
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { isMuted: true, mutedUntil: until },
      });
      return;
    }
    const far = new Date('2099-12-31T23:59:59.999Z');
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isMuted: true, mutedUntil: far },
    });
  }

  /** B-18 — DM ayrılamaz; tek üye kalamaz. */
  async leaveConversation(userId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(conversationId, userId);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      select: { type: true },
    });
    if (!conv) {
      throw new NotFoundException({
        error: 'Conversation not found',
        code: ErrorCodes.NOT_FOUND,
      });
    }
    if (conv.type === 'DIRECT') {
      throw new BadRequestException({
        error: 'cannot_leave_direct',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    const active = await this.prisma.conversationParticipant.count({
      where: { conversationId, leftAt: null },
    });
    if (active <= 1) {
      throw new BadRequestException({
        error: 'cannot_leave_sole_member',
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { leftAt: new Date() },
    });
  }

  async getDirectPartner(
    conversationId: string,
    userId: string,
  ): Promise<string | null> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conv || conv.type !== 'DIRECT') return null;
    const other = conv.participants.find((p) => p.userId !== userId);
    return other?.userId ?? null;
  }

  private async assertNotBlocked(userA: string, userB: string): Promise<void> {
    // Spec 7.2.2 - blocked iki yonlu kontrol
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { initiatorId: userA, targetId: userB },
          { initiatorId: userB, targetId: userA },
        ],
      },
    });
    if (block) {
      throw new ForbiddenException({
        error: 'Cannot message blocked user',
        code: ErrorCodes.BLOCKED,
      });
    }
  }

  private toDetail(
    conv: Conversation & {
      participants: Array<ConversationParticipant & { user: { id: string; username: string; avatarUrl: string | null } }>;
    },
  ): ConversationDetail {
    return {
      id: conv.id,
      type: conv.type as PrismaConversationType,
      name: conv.name ?? null,
      avatarUrl: conv.avatarUrl ?? null,
      communityId: conv.communityId ?? null,
      participants: conv.participants.map((p) => ({
        userId: p.userId,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl ?? null,
        isMuted: p.isMuted,
        mutedUntil: p.mutedUntil?.toISOString() ?? null,
        lastReadAt: p.lastReadAt?.toISOString() ?? null,
        joinedAt: p.joinedAt.toISOString(),
        leftAt: p.leftAt?.toISOString() ?? null,
      })),
      createdAt: conv.createdAt.toISOString(),
    };
  }

  private toMessageDto(m: Message, reactions: MessageReaction[]): MessageDto {
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
