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
};

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;
