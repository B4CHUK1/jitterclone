import { useEffect } from 'react';
import { Toolbar } from '@/ui/components/Toolbar';
import { Canvas } from '@/ui/components/Canvas';
import { PropertiesPanel } from '@/ui/panels/PropertiesPanel';
import { useDocumentStore, useEditorStore } from '@/state';
import styles from './App.module.css';

export function App() {
  const setTool = useEditorStore((s) => s.setTool);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const removeNode = useDocumentStore((s) => s.removeNode);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'r':
          setTool('rectangle');
          break;
        case 'o':
          setTool('ellipse');
          break;
        case 'h':
          setTool('hand');
          break;
        case 'escape':
          deselectAll();
          break;
        case 'delete':
        case 'backspace':
          for (const id of selectedIds) {
            removeNode(id);
          }
          deselectAll();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, deselectAll, selectedIds, removeNode]);

  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.main}>
        <Canvas />
        <PropertiesPanel />
      </div>
    </div>
  );
}
