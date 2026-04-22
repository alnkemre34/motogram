import { NavigationContainer } from '@react-navigation/native';

import { useAuthStore } from '../store/auth.store';

import { AuthNavigator } from './AuthNavigator';
import { linking } from './linking';
import { TabNavigator } from './TabNavigator';

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.userId));
  return (
    // Spec 2.1 + Faz 5 - motogram:// deep link yonlendirme.
    <NavigationContainer linking={isAuthenticated ? linking : undefined}>
      {isAuthenticated ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
