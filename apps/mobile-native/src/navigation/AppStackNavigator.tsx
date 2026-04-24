import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { InboxScreen } from '../screens/inbox/InboxScreen';
import { NotificationsScreen } from '../screens/home/NotificationsScreen';
import { NotificationPreferencesScreen } from '../screens/settings/NotificationPreferencesScreen';
import { EmergencyContactsScreen } from '../screens/settings/EmergencyContactsScreen';
import { BlockedUsersScreen } from '../screens/settings/BlockedUsersScreen';
import { AccountDeletionScreen } from '../screens/settings/AccountDeletionScreen';
import { ChangePasswordScreen } from '../screens/settings/ChangePasswordScreen';
import { ChangeEmailScreen } from '../screens/settings/ChangeEmailScreen';
import { VerifyEmailScreen } from '../screens/settings/VerifyEmailScreen';
import { ChangeUsernameScreen } from '../screens/settings/ChangeUsernameScreen';
import { EditProfileScreen } from '../screens/settings/EditProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { DevicesScreen } from '../screens/settings/DevicesScreen';
import { CommunityDetailScreen } from '../screens/community/CommunityDetailScreen';
import { CreateCommunityScreen } from '../screens/community/CreateCommunityScreen';
import { ConversationScreen } from '../screens/inbox/ConversationScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { EventCreateScreen } from '../screens/event/EventCreateScreen';
import { StoryViewerScreen } from '../screens/story/StoryViewerScreen';

import { TabNavigator } from './TabNavigator';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0b0d' } }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} options={{ title: 'Main' }} />
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="AccountDeletion" component={AccountDeletionScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ChangeUsername" component={ChangeUsernameScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Devices" component={DevicesScreen} />
      <Stack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EventCreate" component={EventCreateScreen} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} />
    </Stack.Navigator>
  );
}

