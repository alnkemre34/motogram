import { z } from 'zod';

// Spec 5.4 - Admin paneli rol hiyerarsisi.
export const UserRoleEnum = z.enum(['USER', 'MODERATOR', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const LocationSharingModeEnum = z.enum([
  'OFF',
  'FOLLOWERS_ONLY',
  'MUTUAL_FOLLOWERS',
  'GROUP_MEMBERS',
  'PARTY_ONLY',
  'PUBLIC',
]);
export type LocationSharingMode = z.infer<typeof LocationSharingModeEnum>;

export const BikeStatusEnum = z.enum(['ACTIVE', 'SOLD', 'WISHLIST', 'PROJECT_BUILD']);
export type BikeStatus = z.infer<typeof BikeStatusEnum>;

export const FollowStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'BLOCKED']);
export type FollowStatus = z.infer<typeof FollowStatusEnum>;

export const MediaTypeEnum = z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'ROUTE_RECAP']);
export type MediaType = z.infer<typeof MediaTypeEnum>;

export const StoryMediaTypeEnum = z.enum(['IMAGE', 'VIDEO']);
export type StoryMediaType = z.infer<typeof StoryMediaTypeEnum>;

export const NotificationTypeEnum = z.enum([
  'FOLLOW',
  'LIKE',
  'COMMENT',
  'MENTION',
  'MESSAGE',
  'EVENT_INVITE',
  'PARTY_INVITE',
  'EMERGENCY_NEARBY',
  'QUEST_COMPLETED',
  'BADGE_EARNED',
  'GROUP_INVITE',
  'SYSTEM',
]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

export const ReportTargetTypeEnum = z.enum([
  'USER',
  'POST',
  'COMMENT',
  'MESSAGE',
  'GROUP',
  'EVENT',
]);
export type ReportTargetType = z.infer<typeof ReportTargetTypeEnum>;

export const ReportStatusEnum = z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof ReportStatusEnum>;

// Spec 3.2 - LiveLocationSession.sourceType
export const SessionSourceEnum = z.enum(['GLOBAL_VISIBILITY', 'PARTY', 'EMERGENCY']);
export type SessionSource = z.infer<typeof SessionSourceEnum>;

// Spec 2.3.1 - Harita filtre cubugu
export const MapFilterEnum = z.enum(['NEARBY', 'FRIENDS', 'PARTIES', 'EVENTS']);
export type MapFilter = z.infer<typeof MapFilterEnum>;

// Spec 7.1.2 - Termal durum (react-native-device-info / Expo Device)
export const ThermalStateEnum = z.enum(['NORMAL', 'FAIR', 'SERIOUS', 'CRITICAL']);
export type ThermalState = z.infer<typeof ThermalStateEnum>;

// Spec 3.2 + 4.1 - Parti yasam dongusu
export const PartyStatusEnum = z.enum(['WAITING', 'RIDING', 'PAUSED', 'ENDED']);
export type PartyStatus = z.infer<typeof PartyStatusEnum>;

export const PartyRoleEnum = z.enum(['LEADER', 'CO_LEADER', 'MEMBER']);
export type PartyRole = z.infer<typeof PartyRoleEnum>;

export const PartyInviteStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']);
export type PartyInviteStatus = z.infer<typeof PartyInviteStatusEnum>;

// Spec 2.3.2 + 7.3.1 - HUD sinyal tipleri (DB'ye YAZILMAZ, sadece WS emit)
export const PartySignalTypeEnum = z.enum(['REGROUP', 'STOP', 'FUEL']);
export type PartySignalType = z.infer<typeof PartySignalTypeEnum>;

// Spec 3.2 - Route.privacy
export const RoutePrivacyEnum = z.enum(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE']);
export type RoutePrivacy = z.infer<typeof RoutePrivacyEnum>;

// ============ FAZ 4 - TOPLULUKLAR / ETKINLIK / MESAJ (Spec 2.4 + 2.5 + 3.2) ============

// Spec 2.4.2 - Community.visibility (Public kars. Private kars. Hidden)
export const CommunityVisibilityEnum = z.enum(['PUBLIC', 'PRIVATE', 'HIDDEN']);
export type CommunityVisibility = z.infer<typeof CommunityVisibilityEnum>;

// Spec 2.4.3 - Community member role (CRUD + moderasyon)
export const CommunityRoleEnum = z.enum(['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']);
export type CommunityRole = z.infer<typeof CommunityRoleEnum>;

// Spec 2.4.2 - Community icinde uye durumu (PRIVATE'ta PENDING akisi)
export const MemberStatusEnum = z.enum(['PENDING', 'ACTIVE', 'BANNED']);
export type MemberStatus = z.infer<typeof MemberStatusEnum>;

// Spec 3.2 - Event.visibility
export const EventVisibilityEnum = z.enum(['PUBLIC', 'PRIVATE', 'GROUP_ONLY']);
export type EventVisibility = z.infer<typeof EventVisibilityEnum>;

// Spec 3.2 - EventParticipant.rsvpStatus (GOING / INTERESTED / NOT_GOING / WAITLIST)
export const RsvpStatusEnum = z.enum(['GOING', 'INTERESTED', 'NOT_GOING', 'WAITLIST']);
export type RsvpStatus = z.infer<typeof RsvpStatusEnum>;

// Spec 3.2 - Conversation.type (DM + grup + topluluk)
export const ConversationTypeEnum = z.enum(['DIRECT', 'GROUP_CHAT', 'COMMUNITY_CHAT']);
export type ConversationType = z.infer<typeof ConversationTypeEnum>;

// Spec 2.5 - Ozel mesaj tipleri (Rota Daveti, Etkinlik Daveti) + SYSTEM
export const MessageTypeEnum = z.enum([
  'TEXT',
  'IMAGE',
  'VIDEO',
  'FILE',
  'RIDE_INVITE',
  'EVENT_INVITE',
  'SYSTEM',
]);
export type MessageType = z.infer<typeof MessageTypeEnum>;

// Spec 9.3 - Push notification cihaz platformu
export const DevicePlatformEnum = z.enum(['IOS', 'ANDROID', 'WEB', 'EXPO']);
export type DevicePlatform = z.infer<typeof DevicePlatformEnum>;

// ============ FAZ 5 - ACIL DURUM / GAMIFICATION / MEDYA (Spec 2.3.2 + 3.4 + 3.6 + 4.4) ============

// Spec 3.2 + 4.4 - Emergency Alert tip (Genel/Kaza/Mekanik/Medikal/Yakit)
export const EmergencyTypeEnum = z.enum([
  'GENERAL',
  'ACCIDENT',
  'MECHANICAL',
  'MEDICAL',
  'FUEL',
  'OTHER',
]);
export type EmergencyType = z.infer<typeof EmergencyTypeEnum>;

// Spec 3.2 - Alert yasam dongusu
export const EmergencyStatusEnum = z.enum([
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'CANCELLED',
  'FALSE_ALARM',
]);
export type EmergencyStatus = z.infer<typeof EmergencyStatusEnum>;

// Spec 3.2 - Yanit veren surucu durumlari
export const ResponderStatusEnum = z.enum([
  'NOTIFIED',
  'ACKNOWLEDGED',
  'EN_ROUTE',
  'ARRIVED',
  'DECLINED',
]);
export type ResponderStatus = z.infer<typeof ResponderStatusEnum>;

// Spec 3.6 - 12 QuestTrigger (SSOT)
export const QuestTriggerEnum = z.enum([
  'POST_CREATED',
  'STORY_CREATED',
  'FOLLOW_GAINED',
  'EVENT_JOINED',
  'EVENT_HOSTED',
  'PARTY_COMPLETED',
  'PARTY_LEAD',
  'ROUTE_CREATED',
  'EMERGENCY_ACKNOWLEDGED',
  'PROFILE_COMPLETED',
  'BIKE_ADDED',
  'COMMUNITY_JOINED',
]);
export type QuestTrigger = z.infer<typeof QuestTriggerEnum>;

export const QuestResetPeriodEnum = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);
export type QuestResetPeriod = z.infer<typeof QuestResetPeriodEnum>;

// Spec 2.6 + 3.2 - Rozet nadirligi
export const BadgeRarityEnum = z.enum([
  'COMMON',
  'UNCOMMON',
  'RARE',
  'EPIC',
  'LEGENDARY',
]);
export type BadgeRarity = z.infer<typeof BadgeRarityEnum>;

// Spec 3.4 + 7.3.7 - Media kategorisi (MinIO klasor hiyerarsisi ile eslesir)
export const MediaCategoryEnum = z.enum([
  'PROFILE_AVATAR',
  'PROFILE_COVER',
  'POST_IMAGE',
  'POST_VIDEO',
  'STORY_IMAGE',
  'STORY_VIDEO',
  'MOTORCYCLE_PHOTO',
  'COMMUNITY_COVER',
  'EVENT_COVER',
  'MESSAGE_ATTACHMENT',
]);
export type MediaCategory = z.infer<typeof MediaCategoryEnum>;

export const MediaStatusEnum = z.enum(['UPLOADING', 'PROCESSING', 'READY', 'FAILED']);
export type MediaStatus = z.infer<typeof MediaStatusEnum>;
