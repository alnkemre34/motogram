import { z } from 'zod';
import type { ZodTypeAny } from 'zod';

import { EmergencyTypeEnum, PartySignalTypeEnum, PartyStatusEnum, ResponderStatusEnum } from '../enums';
import { MessageDtoResponseSchema, MessageReactionDtoResponseSchema } from './message.schema';
import { PartyMemberSchema } from './party.schema';

// Spec 3.5 - Gercek Zamanli Olay Sozlesmesi (WebSocket)
// SSOT: client ve server bu semalari import eder. Hardcoded event ismi yazmak yasak.

export const WS_EVENTS = {
  // Client -> Server
  partyJoin: 'party:join',
  partyLeave: 'party:leave',
  partyUpdateLocation: 'party:update_location',
  partySendSignal: 'party:send_signal',
  // Server -> Client
  partyMemberUpdated: 'party:member_updated',
  partyMemberJoined: 'party:member_joined',
  partyMemberLeft: 'party:member_left',
  partyStatusChanged: 'party:status_changed',
  partySignalReceived: 'party:signal_received',
  partyLeaderChanged: 'party:leader_changed',
  partyEnded: 'party:ended',
  partyError: 'party:error',
  // Faz 4 - Mesajlasma (Spec 3.5 + 2.5)
  // Client -> Server
  conversationJoin: 'conversation:join',
  conversationLeave: 'conversation:leave',
  messageSend: 'message:send',
  messageTyping: 'message:typing',
  messageRead: 'message:read',
  messageReact: 'message:react',
  // Server -> Client
  messageReceived: 'message:received',
  messageReadBy: 'message:read_by',
  messageReactionUpdated: 'message:reaction_updated',
  messageTypingUpdated: 'message:typing_updated',
  messageDeleted: 'message:deleted',
  messageError: 'message:error',
  // Faz 5 - Acil Durum (Spec 2.3.2 + 3.5 + 3.7)
  emergencyNearby: 'emergency:nearby',
  emergencyResponderUpdated: 'emergency:responder_updated',
  emergencyResolved: 'emergency:resolved',
  emergencyCancelled: 'emergency:cancelled',
  // Faz 5 - Gamification feedback (server -> client toast/modal)
  questCompleted: 'quest:completed',
  badgeEarned: 'badge:earned',
} as const;
export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ====== Client -> Server ======
export const WsPartyJoinSchema = z.object({
  partyId: z.string().uuid(),
});
export type WsPartyJoinPayload = z.infer<typeof WsPartyJoinSchema>;

export const WsPartyLeaveSchema = z.object({
  partyId: z.string().uuid(),
});
export type WsPartyLeavePayload = z.infer<typeof WsPartyLeaveSchema>;

export const WsPartyUpdateLocationSchema = z.object({
  partyId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(300).optional(),
  accuracy: z.number().positive().optional(),
  batteryLevel: z.number().min(0).max(1).optional(),
  clientTimestamp: z.number().int().positive(),
});
export type WsPartyUpdateLocationPayload = z.infer<typeof WsPartyUpdateLocationSchema>;

export const WsPartySendSignalSchema = z.object({
  partyId: z.string().uuid(),
  type: PartySignalTypeEnum,
  clientTimestamp: z.number().int().positive(),
});
export type WsPartySendSignalPayload = z.infer<typeof WsPartySendSignalSchema>;

// ====== Server -> Client ======
export const WsPartyMemberUpdatedSchema = z.object({
  partyId: z.string().uuid(),
  userId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().min(0).max(300).nullable().optional(),
  timestamp: z.number().int().positive(),
});
export type WsPartyMemberUpdatedPayload = z.infer<typeof WsPartyMemberUpdatedSchema>;

export const WsPartyMemberJoinedSchema = z.object({
  partyId: z.string().uuid(),
  member: PartyMemberSchema,
});
export type WsPartyMemberJoinedPayload = z.infer<typeof WsPartyMemberJoinedSchema>;

export const WsPartyMemberLeftSchema = z.object({
  partyId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.enum(['LEFT', 'DISCONNECT_TIMEOUT', 'KICKED']).default('LEFT'),
});
export type WsPartyMemberLeftPayload = z.infer<typeof WsPartyMemberLeftSchema>;

export const WsPartyStatusChangedSchema = z.object({
  partyId: z.string().uuid(),
  status: PartyStatusEnum,
});
export type WsPartyStatusChangedPayload = z.infer<typeof WsPartyStatusChangedSchema>;

// Spec 7.3.1 - Sinyal PAYLOAD'i DB'ye YAZILMAZ, sadece broadcast.
export const WsPartySignalReceivedSchema = z.object({
  partyId: z.string().uuid(),
  type: PartySignalTypeEnum,
  senderId: z.string().uuid(),
  senderName: z.string(),
  timestamp: z.number().int().positive(),
});
export type WsPartySignalReceivedPayload = z.infer<typeof WsPartySignalReceivedSchema>;

export const WsPartyLeaderChangedSchema = z.object({
  partyId: z.string().uuid(),
  newLeaderId: z.string().uuid(),
  reason: z.enum(['LEADER_LEFT', 'LEADER_OFFLINE', 'MANUAL']).default('LEADER_LEFT'),
});
export type WsPartyLeaderChangedPayload = z.infer<typeof WsPartyLeaderChangedSchema>;

export const WsPartyEndedSchema = z.object({
  partyId: z.string().uuid(),
  reason: z.enum(['LEADER_LEFT_ALONE', 'MANUAL', 'TIMEOUT']).default('MANUAL'),
});
export type WsPartyEndedPayload = z.infer<typeof WsPartyEndedSchema>;

export const WsPartyErrorSchema = z.object({
  event: z.string(),
  code: z.string(),
  message: z.string(),
});
export type WsPartyErrorPayload = z.infer<typeof WsPartyErrorSchema>;

// ================== FAZ 4 - MESAJLASMA (Spec 3.5 + 2.5) ==================

export const WsConversationJoinSchema = z.object({
  conversationId: z.string().uuid(),
});
export type WsConversationJoinPayload = z.infer<typeof WsConversationJoinSchema>;

export const WsConversationLeaveSchema = z.object({
  conversationId: z.string().uuid(),
});
export type WsConversationLeavePayload = z.infer<typeof WsConversationLeaveSchema>;

// Spec 7.1.1 - clientId optimistic UI icin server'a geri dondurulur.
export const WsMessageSendSchema = z.object({
  conversationId: z.string().uuid(),
  clientId: z.string().uuid(),
  messageType: z.enum([
    'TEXT',
    'IMAGE',
    'VIDEO',
    'FILE',
    'RIDE_INVITE',
    'EVENT_INVITE',
    'SYSTEM',
  ]),
  content: z.string().max(4000).optional(),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  inviteData: z.record(z.unknown()).optional(),
  clientTimestamp: z.number().int().positive(),
});
export type WsMessageSendPayload = z.infer<typeof WsMessageSendSchema>;

export const WsMessageTypingSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean(),
});
export type WsMessageTypingPayload = z.infer<typeof WsMessageTypingSchema>;

export const WsMessageReadSchema = z.object({
  conversationId: z.string().uuid(),
  readAt: z.number().int().positive(),
});
export type WsMessageReadPayload = z.infer<typeof WsMessageReadSchema>;

export const WsMessageReactSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(16),
  remove: z.boolean().default(false),
});
export type WsMessageReactPayload = z.infer<typeof WsMessageReactSchema>;

// Server -> Client
export const WsMessageReceivedSchema = z.object({
  conversationId: z.string().uuid(),
  message: MessageDtoResponseSchema,
});
export type WsMessageReceivedPayload = z.infer<typeof WsMessageReceivedSchema>;

export const WsMessageReadBySchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  readAt: z.number().int().positive(),
});
export type WsMessageReadByPayload = z.infer<typeof WsMessageReadBySchema>;

export const WsMessageReactionUpdatedSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  removed: z.boolean(),
  reaction: MessageReactionDtoResponseSchema,
});
export type WsMessageReactionUpdatedPayload = z.infer<
  typeof WsMessageReactionUpdatedSchema
>;

export const WsMessageTypingUpdatedSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  isTyping: z.boolean(),
});
export type WsMessageTypingUpdatedPayload = z.infer<
  typeof WsMessageTypingUpdatedSchema
>;

export const WsMessageDeletedSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});
export type WsMessageDeletedPayload = z.infer<typeof WsMessageDeletedSchema>;

export const WsMessageErrorSchema = z.object({
  event: z.string(),
  code: z.string(),
  message: z.string(),
  clientId: z.string().optional(),
});
export type WsMessageErrorPayload = z.infer<typeof WsMessageErrorSchema>;

// ================== FAZ 5 - ACIL DURUM (Spec 2.3.2 + 3.5) ==================

export const WsEmergencyNearbySchema = z.object({
  alertId: z.string().uuid(),
  requesterId: z.string().uuid(),
  requesterUsername: z.string(),
  type: EmergencyTypeEnum,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  distanceMeters: z.number().nonnegative(),
  createdAt: z.string().datetime(),
});
export type WsEmergencyNearbyPayload = z.infer<typeof WsEmergencyNearbySchema>;

export const WsEmergencyResponderUpdatedSchema = z.object({
  alertId: z.string().uuid(),
  responderId: z.string().uuid(),
  status: ResponderStatusEnum,
  etaSeconds: z.number().int().nullable(),
  updatedAt: z.string().datetime(),
});
export type WsEmergencyResponderUpdatedPayload = z.infer<
  typeof WsEmergencyResponderUpdatedSchema
>;

export const WsEmergencyResolvedSchema = z.object({
  alertId: z.string().uuid(),
  resolution: z.enum(['RESOLVED', 'CANCELLED', 'FALSE_ALARM']),
  resolvedAt: z.string().datetime(),
});
export type WsEmergencyResolvedPayload = z.infer<typeof WsEmergencyResolvedSchema>;

// ================== FAZ 5 - GAMIFICATION (Spec 3.6 + 3.7) ==================

export const WsQuestCompletedSchema = z.object({
  questId: z.string().uuid(),
  questCode: z.string(),
  questName: z.string(),
  xpAwarded: z.number().int().nonnegative(),
  newUserLevel: z.number().int().positive(),
  newUserXp: z.number().int().nonnegative(),
});
export type WsQuestCompletedPayload = z.infer<typeof WsQuestCompletedSchema>;

export const WsBadgeEarnedSchema = z.object({
  badgeId: z.string().uuid(),
  badgeCode: z.string(),
  badgeName: z.string(),
  iconUrl: z.string().url().nullable(),
  rarity: z.string(),
});
export type WsBadgeEarnedPayload = z.infer<typeof WsBadgeEarnedSchema>;

/** Client -> Server emit oncesi dogrulama (mobil istemci) */
export const WS_INBOUND_SCHEMAS: Partial<Record<WsEventName, ZodTypeAny>> = {
  [WS_EVENTS.partyJoin]: WsPartyJoinSchema,
  [WS_EVENTS.partyLeave]: WsPartyLeaveSchema,
  [WS_EVENTS.partyUpdateLocation]: WsPartyUpdateLocationSchema,
  [WS_EVENTS.partySendSignal]: WsPartySendSignalSchema,
  [WS_EVENTS.conversationJoin]: WsConversationJoinSchema,
  [WS_EVENTS.conversationLeave]: WsConversationLeaveSchema,
  [WS_EVENTS.messageSend]: WsMessageSendSchema,
  [WS_EVENTS.messageTyping]: WsMessageTypingSchema,
  [WS_EVENTS.messageRead]: WsMessageReadSchema,
  [WS_EVENTS.messageReact]: WsMessageReactSchema,
};

/** Server -> Client emit oncesi dogrulama (gateway) */
export const WS_OUTBOUND_SCHEMAS: Partial<Record<WsEventName, ZodTypeAny>> = {
  [WS_EVENTS.partyMemberUpdated]: WsPartyMemberUpdatedSchema,
  [WS_EVENTS.partyMemberJoined]: WsPartyMemberJoinedSchema,
  [WS_EVENTS.partyMemberLeft]: WsPartyMemberLeftSchema,
  [WS_EVENTS.partyStatusChanged]: WsPartyStatusChangedSchema,
  [WS_EVENTS.partySignalReceived]: WsPartySignalReceivedSchema,
  [WS_EVENTS.partyLeaderChanged]: WsPartyLeaderChangedSchema,
  [WS_EVENTS.partyEnded]: WsPartyEndedSchema,
  [WS_EVENTS.partyError]: WsPartyErrorSchema,
  [WS_EVENTS.messageReceived]: WsMessageReceivedSchema,
  [WS_EVENTS.messageReadBy]: WsMessageReadBySchema,
  [WS_EVENTS.messageReactionUpdated]: WsMessageReactionUpdatedSchema,
  [WS_EVENTS.messageTypingUpdated]: WsMessageTypingUpdatedSchema,
  [WS_EVENTS.messageDeleted]: WsMessageDeletedSchema,
  [WS_EVENTS.messageError]: WsMessageErrorSchema,
  [WS_EVENTS.emergencyNearby]: WsEmergencyNearbySchema,
  [WS_EVENTS.emergencyResponderUpdated]: WsEmergencyResponderUpdatedSchema,
  [WS_EVENTS.emergencyResolved]: WsEmergencyResolvedSchema,
  [WS_EVENTS.questCompleted]: WsQuestCompletedSchema,
  [WS_EVENTS.badgeEarned]: WsBadgeEarnedSchema,
};
