import { useEditorStore, useViewportStore, useDocumentStore } from '@/state';
import type { EditorTool } from '@/state/editorStore';
import { defaultTransform } from '@/engine/transform/transform';
import styles from './Toolbar.module.css';

const tools: { id: EditorTool; label: string; shortcut: string }[] = [
  { id: 'select', label: 'V', shortcut: 'V' },
  { id: 'rectangle', label: 'R', shortcut: 'R' },
  { id: 'ellipse', label: 'O', shortcut: 'O' },
  { id: 'hand', label: 'H', shortcut: 'H' },
];

export function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const zoom = useViewportStore((s) => s.zoom);
  const addNode = useDocumentStore((s) => s.addNode);
  const select = useEditorStore((s) => s.select);

  const handleAddShape = (type: 'rectangle' | 'ellipse') => {
    const id = addNode(type, {
      transform: {
        ...defaultTransform(),
        x: 800,
        y: 400,
        width: 200,
        height: 200,
      },
    });
    select(id);
    setTool('select');
  };

  return (
    <div className={styles.toolbar}>
      <span className={styles.title}>Jitter</span>
      <div className={styles.separator} />

      <div className={styles.toolGroup}>
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`${styles.toolButton} ${activeTool === tool.id ? styles.active : ''}`}
            onClick={() => {
              if (tool.id === 'rectangle' || tool.id === 'ellipse') {
                handleAddShape(tool.id);
              } else {
                setTool(tool.id);
              }
            }}
            title={`${tool.id} (${tool.shortcut})`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div className={styles.spacer} />
      <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
    </div>
  );
}
