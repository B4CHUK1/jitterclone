/**
 * Resize interaction logic.
 * Handles corner and edge resizing with proper anchor point behavior.
 * Supports Shift (preserve aspect) and Alt (resize from center).
 */

import type { Vec2 } from '@/engine/transform';
import type { Transform } from '@/engine/transform/transform';
import type { ResizeHandle } from '@/state/editorStore';
import { degToRad } from '@/engine/transform';

export interface ResizeState {
  readonly handle: ResizeHandle;
  readonly startWorldPoint: Vec2;
  readonly startTransform: Transform;
  readonly nodeId: string;
}

export function beginResize(
  handle: ResizeHandle,
  worldPoint: Vec2,
  nodeId: string,
  transform: Transform,
): ResizeState {
  return {
    handle,
    startWorldPoint: worldPoint,
    startTransform: transform,
    nodeId,
  };
}

export interface ResizeModifiers {
  shift: boolean; // preserve aspect ratio
  alt: boolean;   // resize from center
}

/**
 * Compute new transform during resize.
 * Maintains the opposite corner/edge as the fixed anchor (or center if Alt).
 */
export function updateResize(
  state: ResizeState,
  currentWorldPoint: Vec2,
  modifiers: ResizeModifiers,
): Partial<Transform> {
  const { handle, startWorldPoint, startTransform: st } = state;
  const { shift: preserveAspect, alt: fromCenter } = modifiers;

  // Rotate world delta into element's local axis
  const angle = degToRad(-st.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rawDx = currentWorldPoint.x - startWorldPoint.x;
  const rawDy = currentWorldPoint.y - startWorldPoint.y;
  const dx = rawDx * cos - rawDy * sin;
  const dy = rawDx * sin + rawDy * cos;

  let newX = st.x;
  let newY = st.y;
  let newW = st.width;
  let newH = st.height;

  const MIN_SIZE = 1;
  const rotAngle = degToRad(st.rotation);
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // Determine which axes are affected by the handle
  const affectsLeft = handle === 'left' || handle === 'top-left' || handle === 'bottom-left';
  const affectsRight = handle === 'right' || handle === 'top-right' || handle === 'bottom-right';
  const affectsTop = handle === 'top' || handle === 'top-left' || handle === 'top-right';
  const affectsBottom = handle === 'bottom' || handle === 'bottom-left' || handle === 'bottom-right';

  // Compute width change
  if (affectsRight) {
    newW = Math.max(MIN_SIZE, st.width + dx);
  } else if (affectsLeft) {
    const dw = Math.min(dx, st.width - MIN_SIZE);
    newW = st.width - dw;
    if (!fromCenter) {
      newX = st.x + dw * cosR;
      newY = st.y + dw * sinR;
    }
  }

  // Compute height change
  if (affectsBottom) {
    newH = Math.max(MIN_SIZE, st.height + dy);
  } else if (affectsTop) {
    const dh = Math.min(dy, st.height - MIN_SIZE);
    newH = st.height - dh;
    if (!fromCenter) {
      newX = (affectsLeft ? newX : st.x) - dh * sinR;
      newY = (affectsLeft ? newY : st.y) + dh * cosR;
    }
  }

  // Preserve aspect ratio (Shift)
  if (preserveAspect && st.width > 0 && st.height > 0) {
    const ratio = st.width / st.height;
    const isCorner = (affectsLeft || affectsRight) && (affectsTop || affectsBottom);
    const isHorizontalEdge = affectsLeft || affectsRight;

    if (isCorner) {
      if (newW / newH > ratio) {
        newH = newW / ratio;
      } else {
        newW = newH * ratio;
      }
    } else if (isHorizontalEdge) {
      newH = newW / ratio;
    } else {
      newW = newH * ratio;
    }
  }

  // Alt: resize from center — mirror the delta on both sides
  if (fromCenter) {
    const dw = newW - st.width;
    const dh = newH - st.height;
    newW = st.width + dw * 2;
    newH = st.height + dh * 2;
    newW = Math.max(MIN_SIZE, newW);
    newH = Math.max(MIN_SIZE, newH);

    // Shift position so center stays fixed
    const halfDw = (newW - st.width) / 2;
    const halfDh = (newH - st.height) / 2;
    newX = st.x - halfDw * cosR + halfDh * sinR;
    newY = st.y - halfDw * sinR - halfDh * cosR;
  }

  return { x: newX, y: newY, width: newW, height: newH };
}
