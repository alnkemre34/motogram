import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { MainTabParamList } from './TabNavigator';

/**
 * Oturum açık: Tab bar + Gelen Kutu + Bildirimler (FRONTEND_UI_UX_BLUEPRINT §5).
 */
export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Inbox: undefined;
  Notifications: undefined;
  StoryViewer: { initialStoryId: string };
  Settings: undefined;
  EditProfile: undefined;
  NotificationPreferences: undefined;
  EmergencyContacts: undefined;
  BlockedUsers: undefined;
  AccountDeletion: undefined;
  /** GET /v1/users/:username — büyük/küçük harf; path’te encode. */
  UserProfile: { username: string };
  ChangePassword: undefined;
  /** POST /auth/email/change (B-07). */
  ChangeEmail: undefined;
  /**
   * POST /auth/email/verify — token (opsiyonel) derin link veya ayarlardan.
   * Path: `email-verify/:token?`
   */
  VerifyEmail: { token?: string };
  /** PATCH /users/me/username (B-06). */
  ChangeUsername: undefined;
  /** GET/DELETE /devices (Spec 9.3). */
  Devices: undefined;
  /** POST /communities — yeni topluluk. */
  CreateCommunity: undefined;
  CommunityDetail: { id: string };
};

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;
