import type { NavigatorScreenParams } from '@react-navigation/native';

import type { MainTabParamList } from './TabNavigator';

/**
 * Oturum açık: Tab bar + Inbox + Notifications (FRONTEND_UI_UX_BLUEPRINT §5).
 */
export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Inbox: undefined;
  Notifications: undefined;
  Settings: undefined;
  NotificationPreferences: undefined;
  EmergencyContacts: undefined;
  BlockedUsers: undefined;
  AccountDeletion: undefined;
  ChangePassword: undefined;
  ChangeEmail: undefined;
  VerifyEmail: { token?: string } | undefined;
  ChangeUsername: undefined;
  EditProfile: undefined;
  Devices: undefined;
  CreateCommunity: undefined;
  CommunityDetail: { id: string };
  Conversation: { id: string };
  UserProfile: { username: string };
  EventCreate: undefined;
  StoryViewer: { initialStoryId: string };
};

