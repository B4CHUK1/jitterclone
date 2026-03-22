/**
 * Editor store — transient editing state, NOT serialized.
 * Selection, active tool, viewport state, interaction state.
 */

import { create } from 'zustand';

export type EditorTool = 'select' | 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'hand' | 'pen';

export type InteractionMode =
  | 'idle'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'marquee'
  | 'panning';

export type ResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

interface EditorState {
  // Selection
  selectedIds: Set<string>;

  // Tool
  activeTool: EditorTool;

  // Interaction
  interactionMode: InteractionMode;
  activeResizeHandle: ResizeHandle | null;

  // Path editing mode (double-click vector editing, Figma-style)
  editingNodeId: string | null;

  // Actions
  select: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  deselectAll: () => void;
  setTool: (tool: EditorTool) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setActiveResizeHandle: (handle: ResizeHandle | null) => void;
  setEditingNode: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedIds: new Set(),
  activeTool: 'select',
  interactionMode: 'idle',
  activeResizeHandle: null,
  editingNodeId: null,

  select: (id) => set({ selectedIds: new Set([id]) }),
  selectMultiple: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),
  deselectAll: () => set({ selectedIds: new Set() }),
  setTool: (tool) => set({ activeTool: tool }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setActiveResizeHandle: (handle) => set({ activeResizeHandle: handle }),
  setEditingNode: (id) => set({ editingNodeId: id }),
}));
