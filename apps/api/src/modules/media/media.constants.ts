// Spec 3.4 + 7.3.4 + 7.3.7 - Medya pipeline sabitleri.

export const MEDIA_QUEUE_NAME = 'media-processing';
export const VIDEO_QUEUE_NAME = 'video-processing';

// Spec 7.3.4 - concurrency 2 (CPU tasmasin).
export const MEDIA_WORKER_CONCURRENCY = 2;

// Spec 3.4.2 - Sharp donusum parametreleri.
export const SHARP_PARAMS = {
  webpQuality: 85,
  thumbnailWidth: 300,
  thumbnailHeight: 300,
  mediumWidth: 1080,
} as const;

// Spec 3.4.3 - Presigned URL gecerlilik suresi (saniye).
export const PRESIGN_TTL_SECONDS = 3600; // 1 saat

// Spec 7.3.7 - MinIO klasor hiyerarsisi icin helper'lar
export const MEDIA_KEYS = {
  tempKey(assetId: string, originalExt: string): string {
    return `tmp/${assetId}.${originalExt}`;
  },
  profileAvatar(userId: string, assetId: string, size: 'thumbnail' | 'medium'): string {
    return `users/${userId}/profile/${assetId}_avatar_${size}.webp`;
  },
  profileCover(userId: string, assetId: string): string {
    return `users/${userId}/profile/${assetId}_cover_medium.webp`;
  },
  garage(userId: string, motorcycleId: string, assetId: string, size: 'thumbnail' | 'medium'): string {
    return `users/${userId}/garage/${motorcycleId}/${assetId}_${size}.webp`;
  },
  post(postId: string, assetId: string, size: 'thumbnail' | 'medium'): string {
    return `posts/${postId}/${assetId}_${size}.webp`;
  },
  story(storyId: string, assetId: string): string {
    return `stories/${storyId}/${assetId}.webp`;
  },
  storyVideo(storyId: string, assetId: string): string {
    return `stories/${storyId}/${assetId}.mp4`;
  },
  message(assetId: string, size: 'thumbnail' | 'medium'): string {
    return `messages/${assetId}_${size}.webp`;
  },
  communityCover(communityId: string, assetId: string): string {
    return `communities/${communityId}/${assetId}_cover_medium.webp`;
  },
  eventCover(eventId: string, assetId: string): string {
    return `events/${eventId}/${assetId}_cover_medium.webp`;
  },
} as const;

// Spec 8.5 - Cache-Control hedefleri (Nginx tarafindan yazilir; servis Media DTO'da bilgi olarak tasir).
export const CACHE_CONTROL = {
  PROFILE_AVATAR: 'public, max-age=31536000, immutable',
  PROFILE_COVER: 'public, max-age=31536000, immutable',
  POST_IMAGE: 'public, max-age=604800',
  POST_VIDEO: 'public, max-age=604800',
  STORY_IMAGE: 'public, max-age=86400',
  STORY_VIDEO: 'public, max-age=86400',
  MOTORCYCLE_PHOTO: 'public, max-age=2592000',
  COMMUNITY_COVER: 'public, max-age=2592000',
  EVENT_COVER: 'public, max-age=2592000',
  MESSAGE_ATTACHMENT: 'private, max-age=604800',
} as const;
