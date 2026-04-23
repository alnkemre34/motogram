import { z } from 'zod';

import { ConversationTypeEnum, MessageTypeEnum } from '../enums';
import { DateLikeSchema } from '../lib/api-response';

// Spec 2.5 / 3.2 / 3.5 - Mesajlar ekrani (DM + Gruplar) ve sohbet odasi.
// Ozel mesaj tipleri (RIDE_INVITE / EVENT_INVITE) ayri inviteData yuku tasir.

// Spec 2.5 - Ozel mesaj payload'lari (Rota Daveti + Etkinlik Daveti)
export const RideInviteDataSchema = z.object({
  partyId: z.string().uuid(),
  partyName: z.string(),
  leaderName: z.string(),
  routeId: z.string().uuid().optional(),
});
export type RideInviteData = z.infer<typeof RideInviteDataSchema>;

export const EventInviteDataSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string(),
  meetingPointName: z.string(),
  startTime: z.string(),
});
export type EventInviteData = z.infer<typeof EventInviteDataSchema>;

// Spec 2.5 - DM veya grup sohbeti acma (group chat icin userIds 2+)
export const CreateConversationSchema = z
  .object({
    type: ConversationTypeEnum,
    userIds: z.array(z.string().uuid()).min(1).max(50),
    name: z.string().trim().min(1).max(80).optional(),
    communityId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'DIRECT' && value.userIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userIds'],
        message: 'DIRECT conversation requires exactly one peer user',
      });
    }
    if (value.type === 'COMMUNITY_CHAT' && !value.communityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['communityId'],
        message: 'COMMUNITY_CHAT requires communityId',
      });
    }
    if (value.type === 'GROUP_CHAT' && value.userIds.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userIds'],
        message: 'GROUP_CHAT requires at least 2 other users',
      });
    }
  });
export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    clientId: z.string().uuid(), // Spec 7.1.1 - optimistic id (idempotency)
    messageType: MessageTypeEnum.default('TEXT'),
    content: z.string().max(4000).optional(),
    mediaUrls: z.array(z.string().url()).max(10).default([]),
    rideInvite: RideInviteDataSchema.optional(),
    eventInvite: EventInviteDataSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasText = Boolean(value.content && value.content.trim().length > 0);
    const hasMedia = value.mediaUrls.length > 0;
    const hasInvite = Boolean(value.rideInvite ?? value.eventInvite);
    if (value.messageType === 'TEXT' && !hasText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: 'TEXT message requires non-empty content',
      });
    }
    if (
      (value.messageType === 'IMAGE' ||
        value.messageType === 'VIDEO' ||
        value.messageType === 'FILE') &&
      !hasMedia
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mediaUrls'],
        message: 'Media message requires at least 1 mediaUrl',
      });
    }
    if (value.messageType === 'RIDE_INVITE' && !value.rideInvite) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rideInvite'],
        message: 'RIDE_INVITE requires rideInvite payload',
      });
    }
    if (value.messageType === 'EVENT_INVITE' && !value.eventInvite) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventInvite'],
        message: 'EVENT_INVITE requires eventInvite payload',
      });
    }
    if (!hasText && !hasMedia && !hasInvite) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['content'],
        message: 'Message must carry text, media, or invite payload',
      });
    }
  });
export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const ReactMessageSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z
    .string()
    .min(1)
    .max(16)
    .regex(/^\p{Extended_Pictographic}.*$/u, 'emoji required'),
  remove: z.boolean().default(false),
});
export type ReactMessageDto = z.infer<typeof ReactMessageSchema>;

export const MessageReactionDtoSchema = z.object({
  messageId: z.string().uuid(),
  userId: z.string().uuid(),
  emoji: z.string(),
  createdAt: z.string(),
});
export type MessageReactionDto = z.infer<typeof MessageReactionDtoSchema>;

export const MessageReactionDtoResponseSchema = MessageReactionDtoSchema.extend({
  createdAt: DateLikeSchema,
});

export const MessageDtoSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  clientId: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  mediaUrls: z.array(z.string()),
  messageType: MessageTypeEnum,
  inviteData: z
    .union([RideInviteDataSchema, EventInviteDataSchema])
    .nullable()
    .optional(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  reactions: z.array(MessageReactionDtoSchema).default([]),
});
export type MessageDto = z.infer<typeof MessageDtoSchema>;

export const MessageDtoResponseSchema = MessageDtoSchema.extend({
  createdAt: DateLikeSchema,
  reactions: z.array(MessageReactionDtoResponseSchema).default([]),
}).passthrough();

export const MessageSendResponseSchema = z.object({
  message: MessageDtoResponseSchema,
  duplicate: z.boolean(),
});

export const MessageListPageResponseSchema = z.object({
  items: z.array(MessageDtoResponseSchema),
  nextCursor: z.string().nullable(),
});

export const MessageReactHttpResponseSchema = z.object({
  reaction: z.object({
    messageId: z.string().uuid(),
    userId: z.string().uuid(),
    emoji: z.string(),
    createdAt: z.string(),
  }),
  removed: z.boolean(),
});

export const ConversationPreviewSchema = z.object({
  id: z.string().uuid(),
  type: ConversationTypeEnum,
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  communityId: z.string().uuid().nullable().optional(),
  otherUserId: z.string().uuid().nullable().optional(), // DM icin karsi taraf
  otherUsername: z.string().nullable().optional(),
  otherAvatarUrl: z.string().url().nullable().optional(),
  lastMessage: MessageDtoSchema.nullable().optional(),
  unreadCount: z.number().int().nonnegative(),
  lastReadAt: z.string().nullable().optional(),
  lastMessageAt: z.string().nullable().optional(),
});
export type ConversationPreview = z.infer<typeof ConversationPreviewSchema>;

export const ConversationDetailSchema = z.object({
  id: z.string().uuid(),
  type: ConversationTypeEnum,
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  communityId: z.string().uuid().nullable().optional(),
  participants: z.array(
    z.object({
      userId: z.string().uuid(),
      username: z.string(),
      avatarUrl: z.string().url().nullable().optional(),
      isMuted: z.boolean(),
      lastReadAt: z.string().nullable().optional(),
      joinedAt: z.string(),
      leftAt: z.string().nullable().optional(),
    }),
  ),
  createdAt: z.string(),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const MarkReadSchema = z.object({
  conversationId: z.string().uuid(),
  lastReadAt: z.coerce.date().optional(),
});
export type MarkReadDto = z.infer<typeof MarkReadSchema>;

/** GET /v1/conversations — optional filter by conversation type (B-02). */
export const ListConversationsQuerySchema = z.object({
  type: ConversationTypeEnum.optional(),
});
export type ListConversationsQueryDto = z.infer<typeof ListConversationsQuerySchema>;

export const ConversationsListResponseSchema = z.object({
  conversations: z.array(ConversationPreviewSchema.passthrough()),
});
