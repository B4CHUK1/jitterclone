/**
 * Viewport store — camera state for the canvas.
 * Zoom, pan, canvas dimensions.
 */

import { create } from 'zustand';
import type { Vec2 } from '@/engine/transform';

interface ViewportState {
  // Camera
  zoom: number;
  panX: number;
  panY: number;

  // Canvas container size (screen pixels)
  containerWidth: number;
  containerHeight: number;

  // Actions
  setZoom: (zoom: number) => void;
  zoomAtPoint: (delta: number, screenPoint: Vec2) => void;
  pan: (dx: number, dy: number) => void;
  setPan: (x: number, y: number) => void;
  setContainerSize: (w: number, h: number) => void;
  resetView: (docWidth: number, docHeight: number) => void;

  // Derived
  screenToWorld: (screenPoint: Vec2) => Vec2;
  worldToScreen: (worldPoint: Vec2) => Vec2;
}

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 64;

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  containerWidth: 800,
  containerHeight: 600,

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),

  zoomAtPoint: (delta, screenPoint) => {
    const state = get();
    const newZoom = clampZoom(state.zoom * (1 + delta));
    const ratio = newZoom / state.zoom;

    // Keep the world point under the cursor fixed
    const newPanX = screenPoint.x - ratio * (screenPoint.x - state.panX);
    const newPanY = screenPoint.y - ratio * (screenPoint.y - state.panY);

    set({ zoom: newZoom, panX: newPanX, panY: newPanY });
  },

  pan: (dx, dy) =>
    set((s) => ({
      panX: s.panX + dx,
      panY: s.panY + dy,
    })),

  setPan: (x, y) => set({ panX: x, panY: y }),

  setContainerSize: (w, h) => set({ containerWidth: w, containerHeight: h }),

  resetView: (docWidth, docHeight) => {
    const { containerWidth, containerHeight } = get();
    const scaleX = containerWidth / docWidth;
    const scaleY = containerHeight / docHeight;
    const zoom = Math.min(scaleX, scaleY) * 0.85;
    const panX = (containerWidth - docWidth * zoom) / 2;
    const panY = (containerHeight - docHeight * zoom) / 2;
    set({ zoom, panX, panY });
  },

  screenToWorld: (screenPoint) => {
    const { zoom, panX, panY } = get();
    return {
      x: (screenPoint.x - panX) / zoom,
      y: (screenPoint.y - panY) / zoom,
    };
  },

  worldToScreen: (worldPoint) => {
    const { zoom, panX, panY } = get();
    return {
      x: worldPoint.x * zoom + panX,
      y: worldPoint.y * zoom + panY,
    };
  },
}));
