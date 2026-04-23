import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartyInviteMineRowSchema } from '@motogram/shared';
import type { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { getParty, listMyInvites, respondInvite } from '../../api/party.api';
import { captureException } from '../../lib/sentry';
import { usePartyStore } from '../../store/party.store';

// Spec 2.5 + 2.4 - Parti sekmesi (Inbox sekmesinde listelenir):
// - PENDING davetiyeler (Kabul / Reddet)
// - Aktif parti varsa kisa ozet + Haritaya Don butonu
// Spec 7.3.1 - Sinyaller DB'de degil, canli. Invitation DB'de.

type PartyInviteMineRow = z.infer<typeof PartyInviteMineRowSchema>;

interface Props {
  onJumpToMap?: () => void;
}

export function PartyInboxScreen({ onJumpToMap }: Props) {
  const { t } = useTranslation();
  const [invites, setInvites] = useState<PartyInviteMineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const party = usePartyStore((s) => s.party);
  const setParty = usePartyStore((s) => s.setParty);

  const load = useCallback(async () => {
    try {
      const rows = await listMyInvites();
      setInvites(rows.filter((i) => i.status === 'PENDING'));
    } catch (err) {
      captureException(err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function handleRespond(invite: PartyInviteMineRow, accept: boolean) {
    setSubmittingId(invite.id);
    try {
      await respondInvite({ inviteId: invite.id, accept });
      if (accept) {
        const detail = await getParty(invite.partyId);
        setParty(detail);
      }
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (accept) onJumpToMap?.();
    } catch (err) {
      captureException(err);
      Alert.alert(t('common.error'), t('inbox.partyInviteError'));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor="#F5A623"
          />
        }
      >
        <Text style={styles.title}>{t('inbox.partyTitle')}</Text>

        {party && (
          <View style={styles.activeCard}>
            <Text style={styles.activeLabel}>{t('inbox.partyActiveLabel')}</Text>
            <Text style={styles.activeName}>{party.name}</Text>
            <Text style={styles.activeMeta}>
              {t('inbox.partyRidersStatus', {
                count: party.memberCount,
                status: t(`inbox.partyStatus.${party.status}`),
              })}
            </Text>
            <Pressable
              onPress={onJumpToMap}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>{t('inbox.partyMapCta')}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('inbox.partyInvitesTitle')}</Text>
        {loading ? (
          <ActivityIndicator color="#F5A623" style={{ marginTop: 24 }} />
        ) : invites.length === 0 ? (
          <Text style={styles.muted}>{t('inbox.partyNoInvites')}</Text>
        ) : (
          invites.map((inv) => (
            <View key={inv.id} style={styles.inviteCard}>
              <Text style={styles.inviteFrom}>
                {t('inbox.partyInviteFrom', { id: inv.inviterId.slice(0, 8) })}
              </Text>
              <Text style={styles.inviteParty}>
                {t('inbox.partyInviteParty', { id: inv.partyId.slice(0, 8) })}
              </Text>
              <View style={styles.inviteActions}>
                <Pressable
                  disabled={submittingId === inv.id}
                  onPress={() => handleRespond(inv, false)}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryBtnText}>{t('inbox.partyDecline')}</Text>
                </Pressable>
                <Pressable
                  disabled={submittingId === inv.id}
                  onPress={() => handleRespond(inv, true)}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryBtnText}>{t('inbox.partyJoin')}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  scroll: { padding: 16, paddingBottom: 48 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 16 },
  sectionTitle: {
    color: '#F5A623',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 8,
  },
  muted: { color: 'rgba(255,255,255,0.5)' },
  activeCard: {
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderColor: '#F5A623',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  activeLabel: { color: '#F5A623', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  activeName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  activeMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 8 },
  inviteCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  inviteFrom: { color: '#fff', fontWeight: '800', fontSize: 15 },
  inviteParty: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F5A623',
  },
  primaryBtnText: { color: '#0b0b10', fontWeight: '900', letterSpacing: 1 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
  pressed: { opacity: 0.7 },
});
