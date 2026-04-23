import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { AppStackParamList } from './types';

// Spec 2.1 + 3.5 + FRONTEND_UI_UX_BLUEPRINT §5 — AppStack: MainTabs + Inbox + Notifications
//   motogram://inbox, motogram://notifications, tab altı path’ler aynı mantık

export const prefixes = [Linking.createURL('/'), 'motogram://', 'https://motogram.app'];

export const linking: LinkingOptions<AppStackParamList> = {
  prefixes,
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: '',
          Map: 'map',
          Community: 'discover',
          Profile: 'profile/:userId?',
        },
      },
      Inbox: {
        path: 'inbox',
        screens: {
          InboxRoot: '',
          Conversation: 'conversation/:id',
        },
      },
      Notifications: 'notifications',
      StoryViewer: {
        path: 'story/:initialStoryId',
        parse: {
          initialStoryId: (id: string) => id,
        },
      },
      Settings: 'settings',
      EditProfile: 'settings/profile',
      NotificationPreferences: 'settings/notifications',
      EmergencyContacts: 'settings/emergency',
      BlockedUsers: 'settings/blocks',
      AccountDeletion: 'settings/account',
      UserProfile: {
        path: 'user/:username',
        parse: {
          username: (u: string) => decodeURIComponent(u),
        },
      },
      ChangePassword: 'settings/password',
      CommunityDetail: {
        path: 'community/:id',
        parse: { id: (id: string) => id },
      },
    },
  },
};

export type DeepLinkTarget =
  | { type: 'POST'; postId: string }
  | { type: 'STORY'; storyId: string }
  | { type: 'PROFILE'; userId: string }
  | { type: 'COMMUNITY'; communityId: string }
  | { type: 'EVENT'; eventId: string }
  | { type: 'PARTY'; partyId: string }
  | { type: 'EMERGENCY'; alertId: string }
  | null;

// Spec 3.5 - Push notification payloadlari bu fonksiyon ile deep link'e cevrilir.
export function parseDeepLink(url: string): DeepLinkTarget {
  const m = url.match(/^([a-z]+):\/\/([^/]+)?\/?(.*)$/i);
  if (!m) return null;
  const host = m[2] ?? '';
  const rest = m[3] ?? '';
  const segments = (host + '/' + rest).split('/').filter(Boolean);
  const knownHosts = new Set([
    'post',
    'story',
    'profile',
    'community',
    'event',
    'party',
    'emergency',
  ]);
  let head = segments[0] ?? '';
  let id = segments[1] ?? '';
  if (!knownHosts.has(head) && segments.length >= 3) {
    head = segments[1]!;
    id = segments[2]!;
  }
  if (!head || !id) return null;
  switch (head) {
    case 'post':
      return { type: 'POST', postId: id };
    case 'story':
      return { type: 'STORY', storyId: id };
    case 'profile':
      return { type: 'PROFILE', userId: id };
    case 'community':
      return { type: 'COMMUNITY', communityId: id };
    case 'event':
      return { type: 'EVENT', eventId: id };
    case 'party':
      return { type: 'PARTY', partyId: id };
    case 'emergency':
      return { type: 'EMERGENCY', alertId: id };
    default:
      return null;
  }
}
