import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { InboxStackNavigator } from './InboxStackNavigator';
import { TabNavigator } from './TabNavigator';
import type { AppStackParamList } from './types';
import { NotificationsScreen } from '../screens/home/NotificationsScreen';
import { StoryViewerScreen } from '../screens/story/StoryViewerScreen';

// FRONTEND_UI_UX_BLUEPRINT §5 — 4 sekmeli tab; Inbox + Notifications stack üstünde

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0b0d' } }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} options={{ title: 'Main' }} />
      <Stack.Screen name="Inbox" component={InboxStackNavigator} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ headerShown: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
