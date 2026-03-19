// src/store/editorStore.js
// Zoom/pan is NOT stored here — Konva Stage manages its own scale/position
// via imperative API (stageRef.current.scale(), stageRef.current.position()).
// This store holds only React UI state.

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
