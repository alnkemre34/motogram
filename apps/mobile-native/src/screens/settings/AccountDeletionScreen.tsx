import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cancelAccountDeletion, getAccountDeletionStatus, requestAccountDeletion } from '../../api/account.api';
import { useAuthStore } from '../../store/auth.store';

export function AccountDeletionScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');

  const q = useQuery({ queryKey: ['account', 'deletion'], queryFn: getAccountDeletionStatus });
  const req = useMutation({
    mutationFn: () =>
      requestAccountDeletion({
        password: password.trim() || undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      setPassword('');
      setReason('');
      void q.refetch();
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelAccountDeletion(),
    onSuccess: () => {
      void q.refetch();
      void queryClient.invalidateQueries({ queryKey: ['me'] });
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
            {t('settings.accountDeletionTitle')}
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
            {t('settings.accountDeletionTitle')}
          </Text>
          <View style={styles.topRight} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }

  const st = q.data;
  if (!st) {
    return null;
  }

  if (st.pending) {
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
            {t('settings.accountDeletionTitle')}
          </Text>
          <View style={styles.topRight} />
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.warn}>{t('settings.deletionPending')}</Text>
          {st.requestedAt ? (
            <Text style={styles.para}>{t('settings.deletionRequestedAt', { at: st.requestedAt.slice(0, 10) })}</Text>
          ) : null}
          {st.scheduledFor ? (
            <Text style={styles.para}>{t('settings.deletionScheduled', { at: st.scheduledFor.slice(0, 10) })}</Text>
          ) : null}
          {st.daysRemaining != null ? (
            <Text style={styles.para}>{t('settings.deletionDays', { n: st.daysRemaining })}</Text>
          ) : null}
          {cancel.isError ? <Text style={styles.err}>{t('settings.deletionError')}</Text> : null}
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              (cancel.isPending || req.isPending) && styles.disabled,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              void cancel.mutateAsync();
            }}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? (
              <ActivityIndicator color="#0b0b0d" />
            ) : (
              <Text style={styles.btnText}>{t('settings.deletionCancelCta')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          {t('settings.accountDeletionTitle')}
        </Text>
        <View style={styles.topRight} />
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('settings.deletionIntro')}</Text>
        {req.isError ? <Text style={styles.err}>{t('settings.deletionError')}</Text> : null}
        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.deletionReason')}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            style={[styles.input, styles.multiline]}
            multiline
            textAlignVertical="top"
            placeholderTextColor="#666"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.deletionPassword')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor="#666"
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.danger, req.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={() => {
            Alert.alert(t('settings.deletionConfirmTitle'), t('settings.deletionConfirmBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.continue'),
                style: 'destructive',
                onPress: () => {
                  void req.mutateAsync();
                },
              },
            ]);
          }}
          disabled={req.isPending}
        >
          {req.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerText}>{t('settings.deletionRequestCta')}</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          onPress={() => {
            void clearSession();
          }}
        >
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </Pressable>
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
  list: { padding: 16, paddingBottom: 40, gap: 8 },
  para: { color: '#aaa', lineHeight: 20 },
  warn: { color: '#e66', fontWeight: '800', fontSize: 16, marginBottom: 12 },
  muted: { color: '#666' },
  err: { color: '#e66' },
  field: { marginBottom: 12 },
  label: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#1a1a1e', borderRadius: 10, padding: 12, color: '#fff' },
  multiline: { minHeight: 100 },
  btn: {
    marginTop: 12,
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#0b0b0d', fontWeight: '800' },
  danger: { marginTop: 8, backgroundColor: '#8b2020', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  dangerText: { color: '#fff', fontWeight: '800' },
  signOut: { marginTop: 24, paddingVertical: 14, borderWidth: 1, borderColor: '#444', borderRadius: 12, alignItems: 'center' },
  signOutText: { color: '#fff' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
