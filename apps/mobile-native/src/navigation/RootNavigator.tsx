import { NavigationContainer, DefaultTheme } from '@react-navigation/native';

import { useAuthStore } from '../store/auth.store';

import { AppStackNavigator } from './AppStackNavigator';
import { AuthNavigator } from './AuthNavigator';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0b0b0d',
    card: '#0b0b0d',
    text: '#fff',
    border: 'rgba(255,255,255,0.08)',
    primary: '#ff6a00',
  },
};

export function RootNavigator() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.userId));

  if (!isHydrated) {
    hydrate();
  }

  return (
    <NavigationContainer theme={theme}>
      {isAuthenticated ? <AppStackNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

