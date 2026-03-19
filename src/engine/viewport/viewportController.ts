/**
 * Viewport controller — handles wheel, pan, zoom events.
 * Reads/writes to the viewport store.
 */

import type { Vec2 } from '@/engine/transform';

export interface ViewportInput {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Compute new viewport state after a wheel event.
 */
export function handleWheel(
  viewport: ViewportInput,
  deltaY: number,
  screenPoint: Vec2,
  ctrlKey: boolean,
): ViewportInput {
  if (ctrlKey) {
    // Zoom
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.02, Math.min(64, viewport.zoom * zoomFactor));
    const ratio = newZoom / viewport.zoom;

    return {
      zoom: newZoom,
      panX: screenPoint.x - ratio * (screenPoint.x - viewport.panX),
      panY: screenPoint.y - ratio * (screenPoint.y - viewport.panY),
    };
  }

  // Pan
  return {
    zoom: viewport.zoom,
    panX: viewport.panX - deltaY * 0,
    panY: viewport.panY - deltaY,
  };
}

/**
 * Compute new viewport state for pinch zoom.
 */
export function handlePinchZoom(
  viewport: ViewportInput,
  scaleDelta: number,
  centerScreen: Vec2,
): ViewportInput {
  const newZoom = Math.max(0.02, Math.min(64, viewport.zoom * scaleDelta));
  const ratio = newZoom / viewport.zoom;

  return {
    zoom: newZoom,
    panX: centerScreen.x - ratio * (centerScreen.x - viewport.panX),
    panY: centerScreen.y - ratio * (centerScreen.y - viewport.panY),
  };
}
