// src/store/editorStore.js
import { create } from 'zustand'

const useEditorStore = create((set) => ({
  selectedId: null,
  playheadTime: 0,
  canvasWidth: 1280,
  canvasHeight: 720,
  zoom: 1,
  panX: 0,
  panY: 0,

  select: (id) => set({ selectedId: id }),
  deselect: () => set({ selectedId: null }),
  setPlayhead: (time) => set({ playheadTime: time }),
  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 0.1), 4) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
}))

export default useEditorStore
