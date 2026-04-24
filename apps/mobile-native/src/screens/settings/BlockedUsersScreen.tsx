import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBlocks, unblockUser } from '../../api/blocks.api';

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function BlockedUsersScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const q = useQuery({ queryKey: ['blocks'], queryFn: fetchBlocks });
  const m = useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      void q.refetch();
    },
  });

  if (q.isError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
            }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {t('settings.blockedTitle')}
          </Text>
          <View style={styles.topRight} />
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (q.isPending && !q.data) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
            }}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {t('settings.blockedTitle')}
          </Text>
          <View style={styles.topRight} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }

  const items = q.data?.items ?? [];
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.blockedTitle')}
        </Text>
        <View style={styles.topRight} />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {m.isError ? <Text style={styles.err}>{t('settings.blockedError')}</Text> : null}
        <Text style={styles.para}>{t('settings.blockedIntro')}</Text>
        {items.length === 0 ? (
          <Text style={styles.muted}>{t('settings.blockedEmpty')}</Text>
        ) : (
          items.map((row) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.textWrap}>
                <Text style={styles.label}>{t('settings.blockedUserLabel')}</Text>
                <Text style={styles.mono} selectable>
                  {shortId(row.targetId)}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.btn, m.isPending && styles.disabled, pressed && styles.pressed]}
                onPress={() => {
                  if (m.isPending) return;
                  void m.mutateAsync(row.targetId);
                }}
                disabled={m.isPending}
                accessibilityLabel={t('settings.blockedUnblockA11y', { id: shortId(row.targetId) })}
              >
                <Text style={styles.btnText}>{t('settings.blockedUnblock')}</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  back: { width: 44, height: 44, justifyContent: 'center' },
  backText: { color: '#ff6a00', fontSize: 32, fontWeight: '300' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },
  topRight: { width: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  para: { color: '#aaa', marginBottom: 16, lineHeight: 20 },
  muted: { color: '#666' },
  err: { color: '#e66', marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  textWrap: { flex: 1 },
  label: { color: '#888', fontSize: 11, marginBottom: 4 },
  mono: { color: '#fff', fontSize: 14, fontFamily: 'monospace' },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#444', borderRadius: 8 },
  btnText: { color: '#ff6a00', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
