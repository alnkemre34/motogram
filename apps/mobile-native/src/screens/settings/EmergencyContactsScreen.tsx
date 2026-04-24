import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEmergencyContact, deleteEmergencyContact, listEmergencyContacts } from '../../api/emergency.api';

export function EmergencyContactsScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const q = useQuery({ queryKey: ['emergency', 'contacts'], queryFn: listEmergencyContacts });
  const add = useMutation({
    mutationFn: () =>
      createEmergencyContact({
        name: name.trim(),
        phone: phone.trim(),
        relationship: relationship.trim() || undefined,
      }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setRelationship('');
      void q.refetch();
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteEmergencyContact(id),
    onSuccess: () => {
      void q.refetch();
    },
  });

  if (q.isError) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('settings.emergencyTitle')}
          </Text>
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
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('settings.emergencyTitle')}
          </Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#ff6a00" />
        </View>
      </SafeAreaView>
    );
  }

  const list = q.data?.contacts ?? [];
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('settings.emergencyTitle')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text style={styles.para}>{t('settings.emergencyIntro')}</Text>
        {add.isError || del.isError ? <Text style={styles.err}>{t('settings.emergencyError')}</Text> : null}
        {list.length === 0 ? (
          <Text style={styles.muted}>{t('settings.emergencyEmpty')}</Text>
        ) : (
          list.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardText}>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={styles.cardPhone}>{c.phone}</Text>
                {c.relationship ? <Text style={styles.cardRel}>{c.relationship}</Text> : null}
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert(t('common.delete'), t('settings.emergencyDeleteConfirm', { name: c.name }), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('common.delete'),
                      style: 'destructive',
                      onPress: () => {
                        void del.mutateAsync(c.id);
                      },
                    },
                  ]);
                }}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              >
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </Pressable>
            </View>
          ))
        )}

        <Text style={styles.addTitle}>{t('settings.emergencyAddTitle')}</Text>
        <Text style={styles.hint}>{t('settings.emergencyPhoneHint')}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.emergencyName')}</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#666" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.emergencyPhone')}</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="phone-pad"
            placeholderTextColor="#666"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('settings.emergencyRel')}</Text>
          <TextInput
            value={relationship}
            onChangeText={setRelationship}
            style={styles.input}
            placeholderTextColor="#666"
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, add.isPending && styles.disabled, pressed && styles.pressed]}
          onPress={() => {
            if (!name.trim() || !phone.trim()) return;
            void add.mutateAsync();
          }}
          disabled={add.isPending}
        >
          {add.isPending ? <ActivityIndicator color="#0b0b0d" /> : <Text style={styles.addText}>{t('settings.emergencyAddCta')}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d' },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32, gap: 8 },
  para: { color: '#aaa', marginBottom: 12, lineHeight: 20 },
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
  cardText: { flex: 1 },
  cardName: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cardPhone: { color: '#ccc', marginTop: 4 },
  cardRel: { color: '#888', marginTop: 2, fontSize: 12 },
  deleteBtn: { padding: 8 },
  deleteText: { color: '#e66' },
  addTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 16 },
  hint: { color: '#666', fontSize: 12, marginBottom: 8 },
  field: { marginBottom: 10 },
  label: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: '#1a1a1e', borderRadius: 10, padding: 12, color: '#fff' },
  addBtn: {
    marginTop: 8,
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addText: { color: '#0b0b0d', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});

