import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Checklist } from './storage';
import { s } from './theme';

type Props = { list: Checklist; onClose: () => void };

export default function Run({ list, onClose }: Props) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const complete = done.size === list.items.length;

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <View style={s.screen}>
      <Text style={s.title}>{list.title}</Text>
      <ScrollView>
        {list.items.map((item, i) => (
          <Pressable key={i} style={s.row} onPress={() => toggle(i)}>
            <Text style={done.has(i) ? s.muted : s.text}>
              {done.has(i) ? '☑' : '☐'}  {item}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.bar}>
        <Pressable onPress={onClose}>
          <Text style={s.muted}>Close</Text>
        </Pressable>
        {complete && (
          <Pressable onPress={onClose}>
            <Text style={s.text}>Done</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
