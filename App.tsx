import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import Editor from './src/Editor';
import Home from './src/Home';
import Run from './src/Run';
import { Checklist, loadChecklists, saveChecklists } from './src/storage';

type Screen =
  | { name: 'home' }
  | { name: 'run'; list: Checklist }
  | { name: 'edit'; list: Checklist | null };

export default function App() {
  const [lists, setLists] = useState<Checklist[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  useEffect(() => {
    loadChecklists().then(setLists);
  }, []);

  const update = (next: Checklist[]) => {
    setLists(next);
    saveChecklists(next);
    setScreen({ name: 'home' });
  };

  const home = () => setScreen({ name: 'home' });

  return (
    <>
      <StatusBar style="dark" />
      {screen.name === 'home' && (
        <Home
          lists={lists}
          onRun={(list) => setScreen({ name: 'run', list })}
          onEdit={(list) => setScreen({ name: 'edit', list })}
        />
      )}
      {screen.name === 'run' && <Run list={screen.list} onClose={home} />}
      {screen.name === 'edit' && (
        <Editor
          list={screen.list}
          onCancel={home}
          onDelete={(id) => update(lists.filter((l) => l.id !== id))}
          onSave={(c) =>
            update(
              lists.some((l) => l.id === c.id)
                ? lists.map((l) => (l.id === c.id ? c : l))
                : [...lists, c],
            )
          }
        />
      )}
    </>
  );
}
