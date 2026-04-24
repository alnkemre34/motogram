import { JoinCommunitySchema } from '@motogram/shared';
import type { CommunityDetail } from '@motogram/shared';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCommunity, joinCommunity, leaveCommunity } from '../../api/community.api';
import { StackScreenHeader } from '../../components/StackScreenHeader';
import { useZodForm } from '../../hooks/useZodForm';
import type { AppStackParamList } from '../../navigation/types';

import { CommunityJoinMessageSchema } from './community-join-form.schema';

type Props = NativeStackScreenProps<AppStackParamList, 'CommunityDetail'>;

export function CommunityDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const communityId = route.params.id;
  const qc = useQueryClient();

  const { control, handleSubmit, reset } = useZodForm(CommunityJoinMessageSchema, {
    defaultValues: { message: '' },
  });

  const q = useQuery<CommunityDetail>({
    queryKey: ['community', communityId],
    queryFn: () => getCommunity(communityId),
  });

  const joinMut = useMutation({
    mutationFn: (body: { message?: string }) =>
      joinCommunity(
        communityId,
        JoinCommunitySchema.pick({ message: true }).parse({
          message: body.message,
        }),
      ),
    onSuccess: (result) => {
      Alert.alert(
        t('community.alertTitle'),
        result.status === 'ACTIVE' ? t('community.joinedActive') : t('community.joinedPending'),
      );
      reset();
      void qc.invalidateQueries({ queryKey: ['community', communityId] });
      void qc.invalidateQueries({ queryKey: ['communities', 'me'] });
    },
  });

  const leaveMut = useMutation({
    mutationFn: () => leaveCommunity(communityId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['community', communityId] });
      void qc.invalidateQueries({ queryKey: ['communities', 'me'] });
    },
  });

  if (q.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StackScreenHeader title={t('community.title')} />
        <View style={styles.centered}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }
  if (q.isError || !q.data) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StackScreenHeader title={t('community.title')} />
        <View style={styles.centered}>
          <Text style={styles.loading}>{t('community.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const c = q.data;
  const isMember = c.viewerRole != null && c.viewerStatus === 'ACTIVE';
  const isPending = c.viewerStatus === 'PENDING';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StackScreenHeader title={c.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.visibility}>{t(`community.visibility.${c.visibility}`)}</Text>
        {c.description ? <Text style={styles.description}>{c.description}</Text> : null}

        <View style={styles.statsRow}>
          <Stat label={t('community.members')} value={c.membersCount} />
          <Stat label={t('community.tags')} value={c.tags.length} />
        </View>

        {isMember ? (
          <Pressable
            style={[styles.button, styles.buttonMuted]}
            onPress={() => void leaveMut.mutate()}
            disabled={leaveMut.isPending}
          >
            <Text style={styles.buttonText}>{t('community.leave')}</Text>
          </Pressable>
        ) : isPending ? (
          <Pressable style={[styles.button, styles.buttonMuted]} disabled>
            <Text style={styles.buttonText}>{t('community.pending')}</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.joinHint}>{t('community.joinHint')}</Text>
            <Controller
              control={control}
              name="message"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.joinMessageInput}
                  placeholder={t('community.joinPlaceholder')}
                  placeholderTextColor="#666"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                  maxLength={500}
                />
              )}
            />
            <Pressable
              style={styles.button}
              onPress={handleSubmit((form) =>
                joinMut.mutate({ message: form.message.trim() ? form.message.trim() : undefined }),
              )}
              disabled={joinMut.isPending}
            >
              <Text style={styles.buttonText}>
                {c.visibility === 'PRIVATE' ? t('community.requestJoin') : t('community.join')}
              </Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>{t('community.rules')}</Text>
        <Text style={styles.sectionBody}>{c.rules ?? t('community.rulesDefault')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 120 },
  loading: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  visibility: { color: '#ff6a00', marginTop: 4, fontSize: 12, letterSpacing: 1 },
  description: { color: '#ccc', marginTop: 12, fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  stat: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, alignItems: 'center' },
  statValue: { color: '#ff6a00', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  button: { backgroundColor: '#ff6a00', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  buttonMuted: { backgroundColor: '#444' },
  buttonText: { color: '#000', fontWeight: '700' },
  sectionTitle: { color: '#fff', fontWeight: '700', marginTop: 20, marginBottom: 8, fontSize: 15 },
  sectionBody: { color: '#aaa', fontSize: 13, lineHeight: 18 },
  joinHint: { color: '#888', fontSize: 12, marginTop: 12 },
  joinMessageInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    minHeight: 48,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
});

