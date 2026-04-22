import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <Text style={styles.brand}>{t('app.name')}</Text>
      <Text style={styles.tagline}>{t('auth.welcome.tagline')}</Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonPrimaryText}>{t('auth.welcome.ctaLogin')}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.buttonSecondaryText}>{t('auth.welcome.ctaRegister')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  brand: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  tagline: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  actions: { width: '100%', gap: 12 },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primary: { backgroundColor: '#ff6a00' },
  secondary: { borderWidth: 1, borderColor: '#444' },
  buttonPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonSecondaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
