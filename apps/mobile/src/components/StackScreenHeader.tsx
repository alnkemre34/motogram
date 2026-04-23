import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { title: string; right?: ReactNode };

export function StackScreenHeader({ title, right }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  return (
    <View style={styles.topRow}>
      <Pressable
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
      >
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    minHeight: 48,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#ff6a00', fontSize: 32, lineHeight: 36, fontWeight: '200' },
  title: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  right: { width: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
