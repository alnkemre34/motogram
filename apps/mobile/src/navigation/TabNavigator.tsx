import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MapScreen } from '../screens/map/MapScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { InboxStackNavigator } from './InboxStackNavigator';

// Spec 2.1 - Ana Navigasyon: 5 sekmeli Tab Bar

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Map: undefined;
  Inbox: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const tabIcon = (glyph: string) => () => <Text style={{ fontSize: 20 }}>{glyph}</Text>;

export function TabNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ff6a00',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('tabs.home'), tabBarIcon: tabIcon('🏠') }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: t('tabs.discover'), tabBarIcon: tabIcon('🔍') }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: t('tabs.map'), tabBarIcon: tabIcon('🗺️') }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxStackNavigator}
        options={{ title: t('tabs.inbox'), tabBarIcon: tabIcon('💬') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}
