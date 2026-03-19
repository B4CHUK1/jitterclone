/**
 * Resize interaction logic.
 * Handles corner and edge resizing with proper anchor point behavior.
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

/**
 * Compute new transform during resize.
 * Maintains the opposite corner/edge as the fixed anchor.
 */
export function updateResize(
  state: ResizeState,
  currentWorldPoint: Vec2,
  preserveAspect: boolean,
): Partial<Transform> {
  const { handle, startWorldPoint, startTransform: st } = state;

  // Compute delta in unrotated local space
  const angle = degToRad(-st.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const rawDx = currentWorldPoint.x - startWorldPoint.x;
  const rawDy = currentWorldPoint.y - startWorldPoint.y;

  // Rotate delta into element's local axis
  const dx = rawDx * cos - rawDy * sin;
  const dy = rawDx * sin + rawDy * cos;

  let newX = st.x;
  let newY = st.y;
  let newW = st.width;
  let newH = st.height;

  const MIN_SIZE = 1;

  // Apply handle-specific logic
  switch (handle) {
    case 'right':
      newW = Math.max(MIN_SIZE, st.width + dx);
      break;
    case 'left': {
      const dw = Math.min(dx, st.width - MIN_SIZE);
      newW = st.width - dw;
      // Move position to compensate
      const rotAngle = degToRad(st.rotation);
      newX = st.x + dw * Math.cos(rotAngle);
      newY = st.y + dw * Math.sin(rotAngle);
      break;
    }
    case 'bottom':
      newH = Math.max(MIN_SIZE, st.height + dy);
      break;
    case 'top': {
      const dh = Math.min(dy, st.height - MIN_SIZE);
      newH = st.height - dh;
      const rotAngle = degToRad(st.rotation);
      newX = st.x - dh * Math.sin(rotAngle);
      newY = st.y + dh * Math.cos(rotAngle);
      break;
    }
    case 'bottom-right':
      newW = Math.max(MIN_SIZE, st.width + dx);
      newH = Math.max(MIN_SIZE, st.height + dy);
      if (preserveAspect) {
        const ratio = st.width / st.height;
        if (newW / newH > ratio) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }
      break;
    case 'top-left': {
      const dw = Math.min(dx, st.width - MIN_SIZE);
      const dh = Math.min(dy, st.height - MIN_SIZE);
      newW = st.width - dw;
      newH = st.height - dh;
      if (preserveAspect) {
        const ratio = st.width / st.height;
        if (newW / newH > ratio) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }
      const rotAngle = degToRad(st.rotation);
      newX = st.x + dw * Math.cos(rotAngle) - dh * Math.sin(rotAngle);
      newY = st.y + dw * Math.sin(rotAngle) + dh * Math.cos(rotAngle);
      break;
    }
    case 'top-right': {
      newW = Math.max(MIN_SIZE, st.width + dx);
      const dh = Math.min(dy, st.height - MIN_SIZE);
      newH = st.height - dh;
      if (preserveAspect) {
        const ratio = st.width / st.height;
        if (newW / newH > ratio) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }
      const rotAngle = degToRad(st.rotation);
      newX = st.x - dh * Math.sin(rotAngle);
      newY = st.y + dh * Math.cos(rotAngle);
      break;
    }
    case 'bottom-left': {
      const dw = Math.min(dx, st.width - MIN_SIZE);
      newW = st.width - dw;
      newH = Math.max(MIN_SIZE, st.height + dy);
      if (preserveAspect) {
        const ratio = st.width / st.height;
        if (newW / newH > ratio) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }
      const rotAngle = degToRad(st.rotation);
      newX = st.x + dw * Math.cos(rotAngle);
      newY = st.y + dw * Math.sin(rotAngle);
      break;
    }
  }

  return { x: newX, y: newY, width: newW, height: newH };
}
