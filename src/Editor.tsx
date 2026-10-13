import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Checklist } from './storage';
import { s } from './theme';

type Props = {
  list: Checklist | null;
  onSave: (c: Checklist) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
};

export default function Editor({ list, onSave, onDelete, onCancel }: Props) {
  const [title, setTitle] = useState(list?.title ?? '');
  const [items, setItems] = useState(list?.items.join('\n') ?? '');

  const save = () => {
    const cleaned = items.split('\n').map((i) => i.trim()).filter(Boolean);
    if (!title.trim() || cleaned.length === 0) return;
    onSave({
      id: list?.id ?? Date.now().toString(),
      title: title.trim(),
      items: cleaned,
    });
  };

  return (
    <View style={s.screen}>
      <TextInput
        style={s.input}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[s.input, { marginTop: 24, minHeight: 160, textAlignVertical: 'top' }]}
        placeholder="One item per line"
        value={items}
        onChangeText={setItems}
        multiline
      />
      <View style={s.bar}>
        <Pressable onPress={onCancel}>
          <Text style={s.muted}>Cancel</Text>
        </Pressable>
        {list && (
          <Pressable onPress={() => onDelete(list.id)}>
            <Text style={s.muted}>Delete</Text>
          </Pressable>
        )}
        <Pressable onPress={save}>
          <Text style={s.text}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
