import { useEditorStore, useViewportStore, useDocumentStore } from '@/state';
import type { EditorTool } from '@/state/editorStore';
import type { NodeType } from '@/document/types';
import { defaultTransform } from '@/engine/transform/transform';
import {
  MousePointer2,
  Square,
  Circle,
  Pentagon,
  Star,
  Minus,
  Hand,
  PenTool,
  Undo2,
  Redo2,
} from 'lucide-react';
import styles from './Toolbar.module.css';

const tools: { id: EditorTool; label: string; shortcut: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 size={16} /> },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square size={16} /> },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle size={16} /> },
  { id: 'polygon', label: 'Polygon', shortcut: 'P', icon: <Pentagon size={16} /> },
  { id: 'star', label: 'Star', shortcut: 'S', icon: <Star size={16} /> },
  { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus size={16} /> },
  { id: 'pen', label: 'Pen', shortcut: 'D', icon: <PenTool size={16} /> },
  { id: 'hand', label: 'Hand', shortcut: 'H', icon: <Hand size={16} /> },
];

const SHAPE_TOOLS: EditorTool[] = ['rectangle', 'ellipse', 'polygon', 'star', 'line'];

export function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const zoom = useViewportStore((s) => s.zoom);
  const addNode = useDocumentStore((s) => s.addNode);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const canUndo = useDocumentStore((s) => s.canUndo);
  const canRedo = useDocumentStore((s) => s.canRedo);
  const select = useEditorStore((s) => s.select);

  const handleAddShape = (type: NodeType) => {
    const overrides: Record<string, unknown> = {
      transform: {
        ...defaultTransform(),
        x: 800,
        y: 400,
        width: 200,
        height: 200,
      },
    };
    if (type === 'polygon') {
      overrides.polygon = { sides: 6 };
    } else if (type === 'star') {
      overrides.star = { points: 5, innerRadius: 0.4 };
    } else if (type === 'line') {
      overrides.transform = {
        ...defaultTransform(),
        x: 800,
        y: 500,
        width: 300,
        height: 4,
      };
      overrides.style = {
        fill: { color: '#5B8DEF', opacity: 1 },
        stroke: { color: '#5B8DEF', width: 2, opacity: 1 },
        opacity: 1,
        cornerRadius: 0,
        effects: [],
        blendMode: 'normal' as const,
      };
    }
    const id = addNode(type, overrides as Partial<import('@/document/types').SceneNode>);
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
              if (SHAPE_TOOLS.includes(tool.id)) {
                handleAddShape(tool.id as NodeType);
              } else {
                setTool(tool.id);
              }
            }}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className={styles.separator} />
      <div className={styles.toolGroup}>
        <button
          className={styles.toolButton}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className={styles.toolButton}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className={styles.spacer} />
      <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
    </div>
  );
}
