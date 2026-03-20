import { useEffect } from 'react';
import { Toolbar } from '@/ui/components/Toolbar';
import { Canvas } from '@/ui/components/Canvas';
import { PropertiesPanel } from '@/ui/panels/PropertiesPanel';
import { TimelinePanel } from '@/ui/panels/TimelinePanel';
import { useDocumentStore, useEditorStore, useTimelineStore } from '@/state';
import styles from './App.module.css';

export function App() {
  const setTool = useEditorStore((s) => s.setTool);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const removeNode = useDocumentStore((s) => s.removeNode);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const composition = useDocumentStore((s) => s.document.composition);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const pause = useTimelineStore((s) => s.pause);

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

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
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
        case 'p':
          setTool('polygon');
          break;
        case 'l':
          setTool('line');
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
  }, [setTool, deselectAll, selectedIds, removeNode, undo, redo]);

  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    let last = performance.now();
    const waStart = composition.workAreaStart;
    const waEnd = composition.workAreaEnd;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      useTimelineStore.setState((state) => {
        const next = state.currentTime + dt;
        if (next >= waEnd) {
          pause();
          return { currentTime: waEnd };
        }
        return { currentTime: next };
      });
      frameId = requestAnimationFrame(tick);
    };

    // If playhead is before work area start, jump to it
    const current = useTimelineStore.getState().currentTime;
    if (current < waStart) {
      useTimelineStore.setState({ currentTime: waStart });
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, composition.workAreaStart, composition.workAreaEnd, pause]);

  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.main}>
        <div className={styles.workspace}>
          <Canvas />
          <TimelinePanel />
        </div>
        <PropertiesPanel />
      </div>
    </div>
  );
}
