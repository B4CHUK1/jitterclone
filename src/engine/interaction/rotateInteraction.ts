/**
 * Rotate interaction logic.
 * Rotates around the element's anchor point.
 */

import type { Vec2 } from '@/engine/transform';
import type { Transform } from '@/engine/transform/transform';
import { radToDeg, normalizeAngle, snapAngle } from '@/engine/transform';
import { getWorldAnchor, computeLocalMatrix } from '@/engine/transform';
import type { Matrix2D } from '@/engine/transform/math';

export interface RotateState {
  readonly nodeId: string;
  readonly startTransform: Transform;
  readonly anchorWorld: Vec2;
  readonly startAngleRad: number;
}

export function beginRotate(
  worldPoint: Vec2,
  nodeId: string,
  transform: Transform,
  worldMatrix?: Matrix2D,
): RotateState {
  // If we already have the scene world matrix, use it.
  // Fallback to local matrix for root-level nodes/tests.
  const effectiveWorldMatrix = worldMatrix ?? computeLocalMatrix(transform);
  const anchorWorld = getWorldAnchor(transform, effectiveWorldMatrix);

  const startAngleRad = Math.atan2(
    worldPoint.y - anchorWorld.y,
    worldPoint.x - anchorWorld.x,
  );

  return {
    nodeId,
    startTransform: transform,
    anchorWorld,
    startAngleRad,
  };
}

export function updateRotate(
  state: RotateState,
  currentWorldPoint: Vec2,
  snap: boolean,
): { rotation: number } {
  const currentAngleRad = Math.atan2(
    currentWorldPoint.y - state.anchorWorld.y,
    currentWorldPoint.x - state.anchorWorld.x,
  );

  const deltaAngleDeg = radToDeg(currentAngleRad - state.startAngleRad);
  let newRotation = normalizeAngle(state.startTransform.rotation + deltaAngleDeg);

  if (snap) {
    newRotation = snapAngle(newRotation, 15);
  }

  return {
    rotation: newRotation,
  };
}
