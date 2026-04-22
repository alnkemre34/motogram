import { JoinCommunitySchema } from '@motogram/shared';
import type { CommunityDetail } from '@motogram/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Controller } from 'react-hook-form';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getCommunity,
  joinCommunity,
  leaveCommunity,
} from '../../api/community.api';
import { useZodForm } from '../../hooks/useZodForm';

import { CommunityJoinMessageSchema } from './community-join-form.schema';

// Spec 2.4.3 - Topluluk detay sayfasi: Duyurular, uyeler, etkinlikler, katil butonu.

type RouteParams = { id: string };

export function CommunityDetailScreen() {
  const route = useRoute<RouteProp<{ CommunityDetail: RouteParams }, 'CommunityDetail'>>();
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
        'Topluluk',
        result.status === 'ACTIVE' ? 'Topluluga katildin.' : 'Katilim talebin gonderildi.',
      );
      reset();
      qc.invalidateQueries({ queryKey: ['community', communityId] });
      qc.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });

  const leaveMut = useMutation({
    mutationFn: () => leaveCommunity(communityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community', communityId] });
      qc.invalidateQueries({ queryKey: ['my-communities'] });
    },
  });

  if (q.isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Yukleniyor...</Text>
      </View>
    );
  }
  if (q.isError || !q.data) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Topluluk bulunamadi.</Text>
      </View>
    );
  }

  const c = q.data;
  const isMember = c.viewerRole !== null && c.viewerRole !== undefined && c.viewerStatus === 'ACTIVE';
  const isPending = c.viewerStatus === 'PENDING';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{c.name}</Text>
      <Text style={styles.visibility}>{c.visibility}</Text>
      {c.description ? <Text style={styles.description}>{c.description}</Text> : null}

      <View style={styles.statsRow}>
        <Stat label="Uye" value={c.membersCount} />
        <Stat label="Etiket" value={c.tags.length} />
      </View>

      {isMember ? (
        <Pressable
          style={[styles.button, { backgroundColor: '#444' }]}
          onPress={() => leaveMut.mutate()}
          disabled={leaveMut.isPending}
        >
          <Text style={styles.buttonText}>Toplulugu Birak</Text>
        </Pressable>
      ) : isPending ? (
        <Pressable style={[styles.button, { backgroundColor: '#444' }]} disabled>
          <Text style={styles.buttonText}>Onay Bekliyor</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.joinHint}>Opsiyonel mesaj (max 500)</Text>
          <Controller
            control={control}
            name="message"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={styles.joinMessageInput}
                placeholder="Moderatorlere kisa not..."
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
              joinMut.mutate({
                message: form.message.trim() ? form.message.trim() : undefined,
              }),
            )}
            disabled={joinMut.isPending}
          >
            <Text style={styles.buttonText}>
              {c.visibility === 'PRIVATE' ? 'Katilim Talebi Gonder' : 'Katil'}
            </Text>
          </Pressable>
        </>
      )}

      <Text style={styles.sectionTitle}>Kurallar</Text>
      <Text style={styles.sectionBody}>
        {c.rules ?? 'Henuz kural eklenmemis. Saygili olun, trafiği ve kendinizi tehlikeye atmayın.'}
      </Text>
    </ScrollView>
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
  content: { padding: 16, paddingBottom: 120 },
  loading: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  visibility: { color: '#ff6a00', marginTop: 4, fontSize: 12, letterSpacing: 1 },
  description: { color: '#ccc', marginTop: 12, fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  stat: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { color: '#ff6a00', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  button: {
    backgroundColor: '#ff6a00',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#000', fontWeight: '700' },
  sectionTitle: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    fontSize: 15,
  },
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
