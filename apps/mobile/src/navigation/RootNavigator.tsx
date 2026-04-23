import { NavigationContainer } from '@react-navigation/native';

import { useAuthStore } from '../store/auth.store';

import { AppStackNavigator } from './AppStackNavigator';
import { AuthNavigator } from './AuthNavigator';
import { linking } from './linking';

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.userId));
  return (
    // Spec 2.1 + Faz 5 - motogram:// deep link; oturumda AppStack (4 tab + Inbox + Bildirimler)
    <NavigationContainer linking={isAuthenticated ? linking : undefined}>
      {isAuthenticated ? <AppStackNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
