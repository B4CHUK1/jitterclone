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
  const MIN_SIZE = 1;

  // Convert pointer delta to element local axes (start frame)
  const angle = degToRad(-st.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rawDx = currentWorldPoint.x - startWorldPoint.x;
  const rawDy = currentWorldPoint.y - startWorldPoint.y;
  const localDx = rawDx * cos - rawDy * sin;
  const localDy = rawDx * sin + rawDy * cos;

  // Determine which axes are affected by the handle
  const affectsLeft = handle === 'left' || handle === 'top-left' || handle === 'bottom-left';
  const affectsRight = handle === 'right' || handle === 'top-right' || handle === 'bottom-right';
  const affectsTop = handle === 'top' || handle === 'top-left' || handle === 'top-right';
  const affectsBottom = handle === 'bottom' || handle === 'bottom-left' || handle === 'bottom-right';

  // Local sides in the element start frame.
  let left = 0;
  let right = st.width;
  let top = 0;
  let bottom = st.height;

  // Move active sides in local space.
  if (fromCenter) {
    if (affectsLeft || affectsRight) {
      left -= localDx;
      right += localDx;
    }
    if (affectsTop || affectsBottom) {
      top -= localDy;
      bottom += localDy;
    }
  } else {
    if (affectsLeft) left += localDx;
    if (affectsRight) right += localDx;
    if (affectsTop) top += localDy;
    if (affectsBottom) bottom += localDy;
  }

  // Clamp min size while keeping the intended fixed side stable.
  if (right - left < MIN_SIZE) {
    if (fromCenter) {
      const cx = (left + right) / 2;
      left = cx - MIN_SIZE / 2;
      right = cx + MIN_SIZE / 2;
    } else if (affectsLeft && !affectsRight) {
      left = right - MIN_SIZE;
    } else {
      right = left + MIN_SIZE;
    }
  }
  if (bottom - top < MIN_SIZE) {
    if (fromCenter) {
      const cy = (top + bottom) / 2;
      top = cy - MIN_SIZE / 2;
      bottom = cy + MIN_SIZE / 2;
    } else if (affectsTop && !affectsBottom) {
      top = bottom - MIN_SIZE;
    } else {
      bottom = top + MIN_SIZE;
    }
  }

  // Preserve aspect ratio (Shift).
  if (preserveAspect && st.width > 0 && st.height > 0) {
    const ratio = st.width / st.height;
    const isCorner = (affectsLeft || affectsRight) && (affectsTop || affectsBottom);
    const isHorizontalEdge = (affectsLeft || affectsRight) && !(affectsTop || affectsBottom);
    const isVerticalEdge = (affectsTop || affectsBottom) && !(affectsLeft || affectsRight);

    if (isCorner) {
      const width = right - left;
      const height = bottom - top;
      if (width / height > ratio) {
        const targetHeight = Math.max(MIN_SIZE, width / ratio);
        if (fromCenter) {
          const cy = (top + bottom) / 2;
          top = cy - targetHeight / 2;
          bottom = cy + targetHeight / 2;
        } else if (affectsTop && !affectsBottom) {
          top = bottom - targetHeight;
        } else {
          bottom = top + targetHeight;
        }
      } else {
        const targetWidth = Math.max(MIN_SIZE, height * ratio);
        if (fromCenter) {
          const cx = (left + right) / 2;
          left = cx - targetWidth / 2;
          right = cx + targetWidth / 2;
        } else if (affectsLeft && !affectsRight) {
          left = right - targetWidth;
        } else {
          right = left + targetWidth;
        }
      }
    } else if (isHorizontalEdge) {
      const targetHeight = Math.max(MIN_SIZE, (right - left) / ratio);
      const cy = st.height / 2;
      top = cy - targetHeight / 2;
      bottom = cy + targetHeight / 2;
    } else if (isVerticalEdge) {
      const targetWidth = Math.max(MIN_SIZE, (bottom - top) * ratio);
      const cx = st.width / 2;
      left = cx - targetWidth / 2;
      right = cx + targetWidth / 2;
    }
  }

  const newW = Math.max(MIN_SIZE, right - left);
  const newH = Math.max(MIN_SIZE, bottom - top);

  const fixedLocalStart = getFixedLocalPoint(handle, st.width, st.height, fromCenter);
  const fixedLocalNew = getFixedLocalPoint(handle, newW, newH, fromCenter);
  const fixedWorld = localToWorldNoParent(st, fixedLocalStart);

  const { x: newX, y: newY } = solvePositionForFixedWorld(st, newW, newH, fixedLocalNew, fixedWorld);

  return { x: newX, y: newY, width: newW, height: newH };
}

function getFixedLocalPoint(
  handle: ResizeHandle,
  width: number,
  height: number,
  fromCenter: boolean,
): Vec2 {
  if (fromCenter) return { x: width / 2, y: height / 2 };
  switch (handle) {
    case 'top-left':
      return { x: width, y: height };
    case 'top':
      return { x: width / 2, y: height };
    case 'top-right':
      return { x: 0, y: height };
    case 'right':
      return { x: 0, y: height / 2 };
    case 'bottom-right':
      return { x: 0, y: 0 };
    case 'bottom':
      return { x: width / 2, y: 0 };
    case 'bottom-left':
      return { x: width, y: 0 };
    case 'left':
      return { x: width, y: height / 2 };
  }
}

function localToWorldNoParent(t: Transform, local: Vec2): Vec2 {
  const angle = degToRad(t.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ax = t.anchorX * t.width;
  const ay = t.anchorY * t.height;

  const rx = (local.x - ax) * t.scaleX;
  const ry = (local.y - ay) * t.scaleY;

  return {
    x: t.x + ax + rx * cos - ry * sin,
    y: t.y + ay + rx * sin + ry * cos,
  };
}

function solvePositionForFixedWorld(
  st: Transform,
  newW: number,
  newH: number,
  fixedLocalNew: Vec2,
  fixedWorld: Vec2,
): Vec2 {
  const angle = degToRad(st.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const ax = st.anchorX * newW;
  const ay = st.anchorY * newH;

  const rx = (fixedLocalNew.x - ax) * st.scaleX;
  const ry = (fixedLocalNew.y - ay) * st.scaleY;

  return {
    x: fixedWorld.x - ax - (rx * cos - ry * sin),
    y: fixedWorld.y - ay - (rx * sin + ry * cos),
  };
}
