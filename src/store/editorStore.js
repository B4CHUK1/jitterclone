// src/store/editorStore.js
import { create } from 'zustand'

const useEditorStore = create((set) => ({
  selectedId: null,
  playheadTime: 0,
  canvasWidth: 1280,
  canvasHeight: 720,

  select: (id) => set({ selectedId: id }),
  deselect: () => set({ selectedId: null }),
  setPlayhead: (time) => set({ playheadTime: time }),
}))

export default useEditorStore
