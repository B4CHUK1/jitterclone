/**
 * Drag/move interaction logic.
 * Pure functions that compute new transforms during drag operations.
 */

import type { Vec2 } from '@/engine/transform';
import type { Transform } from '@/engine/transform/transform';

export interface DragState {
  readonly startWorldPoint: Vec2;
  readonly startTransforms: ReadonlyMap<string, Transform>;
}

/**
 * Start a drag interaction.
 */
export function beginDrag(
  worldPoint: Vec2,
  selectedIds: ReadonlySet<string>,
  getTransform: (id: string) => Transform | undefined,
): DragState {
  const startTransforms = new Map<string, Transform>();
  for (const id of selectedIds) {
    const t = getTransform(id);
    if (t) startTransforms.set(id, t);
  }
  return {
    startWorldPoint: worldPoint,
    startTransforms,
  };
}

/**
 * Compute new transforms during drag.
 * Returns a map of nodeId → partial transform updates.
 */
export function updateDrag(
  state: DragState,
  currentWorldPoint: Vec2,
): Map<string, { x: number; y: number }> {
  const dx = currentWorldPoint.x - state.startWorldPoint.x;
  const dy = currentWorldPoint.y - state.startWorldPoint.y;

  const updates = new Map<string, { x: number; y: number }>();
  for (const [id, startT] of state.startTransforms) {
    updates.set(id, {
      x: startT.x + dx,
      y: startT.y + dy,
    });
  }

  return updates;
}
