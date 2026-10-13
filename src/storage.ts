import AsyncStorage from '@react-native-async-storage/async-storage';

export type Checklist = {
  id: string;
  title: string;
  items: string[];
};

const KEY = 'checklists';

export async function loadChecklists(): Promise<Checklist[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Checklist[]) : [];
  } catch {
    return [];
  }
}

export async function saveChecklists(lists: Checklist[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(lists));
}
