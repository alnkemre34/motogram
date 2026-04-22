import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

// Spec 9.3 + Faz 1 Adim 24 - Soft Push Prompt.
// Amac: Apple'in HIG'ine uygun sekilde OS'a gitmeden ONCE kullaniciya niyetimizi
// aciklayan bir dialog sunmak. Kullanici "Izin ver"e basarsa OS prompt'u acilir.

interface Props {
  visible: boolean;
  onConfirm: () => void | Promise<void>;
  onDismiss: () => void;
}

export function SoftPushPromptModal({ visible, onConfirm, onDismiss }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔔</Text>
          <Text style={styles.title}>Parti daveti ve mesajlari kacirma</Text>
          <Text style={styles.body}>
            Motogram, yakindaki surus davetleri, yeni mesajlar ve topluluk duyurulari icin
            bildirim gondermek ister. Istediginiz zaman ayarlardan kapatabilirsiniz.
          </Text>
          <Pressable style={styles.primary} onPress={onConfirm}>
            <Text style={styles.primaryText}>Izin ver</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onDismiss}>
            <Text style={styles.secondaryText}>Simdilik degil</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  emoji: { fontSize: 42, marginBottom: 10 },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: { color: '#bbb', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  primary: {
    backgroundColor: '#ff6a00',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryText: { color: '#000', fontWeight: '700', fontSize: 15 },
  secondary: { paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center' },
  secondaryText: { color: '#888', fontSize: 13 },
});
