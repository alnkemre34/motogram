import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { MapScreen } from '../screens/map/MapScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

// Spec 2.1 / FRONTEND_UI_UX_BLUEPRINT §5.1 - 4 sekmeli Tab Bar (Inbox ayrı tab değil)

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Community: undefined;
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
        name="Map"
        component={MapScreen}
        options={{ title: t('tabs.map'), tabBarIcon: tabIcon('🗺️') }}
      />
      <Tab.Screen
        name="Community"
        component={DiscoverScreen}
        options={{ title: t('tabs.community'), tabBarIcon: tabIcon('👥') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('👤') }}
      />
    </Tab.Navigator>
  );
}
