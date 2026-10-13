import { StyleSheet } from 'react-native';

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: 64, paddingHorizontal: 24 },
  title: { fontSize: 22, marginBottom: 24 },
  row: { paddingVertical: 14 },
  text: { fontSize: 17 },
  muted: { fontSize: 17, color: '#999' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 24 },
  input: { fontSize: 17, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#ddd' },
});
