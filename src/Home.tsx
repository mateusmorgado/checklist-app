import { FlatList, Pressable, Text, View } from 'react-native';
import { Checklist } from './storage';
import { s } from './theme';

type Props = {
  lists: Checklist[];
  onRun: (c: Checklist) => void;
  onEdit: (c: Checklist | null) => void;
};

export default function Home({ lists, onRun, onEdit }: Props) {
  return (
    <View style={s.screen}>
      <FlatList
        data={lists}
        keyExtractor={(c) => c.id}
        ListEmptyComponent={<Text style={s.muted}>No checklists</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={s.row}
            onPress={() => onRun(item)}
            onLongPress={() => onEdit(item)}
          >
            <Text style={s.text}>{item.title}</Text>
          </Pressable>
        )}
      />
      <View style={s.bar}>
        <Pressable onPress={() => onEdit(null)}>
          <Text style={s.text}>+ New</Text>
        </Pressable>
        <Text style={s.muted}>Hold to edit</Text>
      </View>
    </View>
  );
}
