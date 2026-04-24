import { StyleSheet, Text, View } from 'react-native';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0d', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

