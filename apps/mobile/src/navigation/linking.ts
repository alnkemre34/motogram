import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { MainTabParamList } from './TabNavigator';

// Spec 2.1 + 3.5 + Faz 5 - motogram:// derin baglantilari.
// App link listesi:
//   motogram://post/:postId           -> HomeScreen focus Post
//   motogram://story/:storyId         -> Story viewer
//   motogram://profile/:userId        -> Profile
//   motogram://community/:id          -> Community detay
//   motogram://event/:id              -> Event detay
//   motogram://party/:id              -> Party overlay
//   motogram://emergency/:alertId     -> SOS responder overlay

export const prefixes = [Linking.createURL('/'), 'motogram://', 'https://motogram.app'];

export const linking: LinkingOptions<MainTabParamList> = {
  prefixes,
  config: {
    screens: {
      Home: {
        path: '',
        screens: {
          Feed: 'feed',
          Post: 'post/:postId',
          Story: 'story/:storyId',
          Emergency: 'emergency/:alertId',
        },
      },
      Discover: {
        path: 'discover',
        screens: {
          Community: 'community/:communityId',
          Event: 'event/:eventId',
        },
      },
      Map: {
        path: 'map',
        screens: {
          Party: 'party/:partyId',
        },
      },
      Inbox: {
        path: 'inbox',
        screens: {
          Conversation: 'conversation/:conversationId',
        },
      },
      Profile: {
        path: 'profile/:userId?',
        screens: {
          Badges: 'badges',
          Garage: 'garage',
        },
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
  // motogram://post/abc -> host=post, pathname=/abc. https://motogram.app/post/abc
  // -> host=motogram.app, pathname=/post/abc. Iki varyanti da desteklemek icin
  // parsing regex tabanli: "scheme://[host/]?segment/id/..."
  const m = url.match(/^([a-z]+):\/\/([^/]+)?\/?(.*)$/i);
  if (!m) return null;
  const host = m[2] ?? '';
  const rest = m[3] ?? '';
  const segments = (host + '/' + rest).split('/').filter(Boolean);
  // https://motogram.app -> segments = ["motogram.app", "post", "abc"]; "motogram.app" atla.
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
