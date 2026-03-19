/**
 * Rotate interaction logic.
 * Rotates around the element's anchor point.
 */

import type { Vec2 } from '@/engine/transform';
import type { Transform } from '@/engine/transform/transform';
import { radToDeg, normalizeAngle, snapAngle } from '@/engine/transform';
import { getWorldAnchor, computeLocalMatrix } from '@/engine/transform';

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
): RotateState {
  const worldMatrix = computeLocalMatrix(transform); // for root-level nodes
  const anchorWorld = getWorldAnchor(transform, worldMatrix);

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
): { rotation: number; x: number; y: number } {
  const currentAngleRad = Math.atan2(
    currentWorldPoint.y - state.anchorWorld.y,
    currentWorldPoint.x - state.anchorWorld.x,
  );

  const deltaAngleDeg = radToDeg(currentAngleRad - state.startAngleRad);
  let newRotation = normalizeAngle(state.startTransform.rotation + deltaAngleDeg);

  if (snap) {
    newRotation = snapAngle(newRotation, 15);
  }

  // For root-level elements, position stays the same when rotating around anchor
  // because position IS the top-left corner, and the matrix handles the rest.
  // But we need to adjust position to keep the anchor point stable.
  const st = state.startTransform;
  const ax = st.anchorX * st.width;
  const ay = st.anchorY * st.height;

  // Compute where the anchor would be with old rotation
  const oldRad = (st.rotation * Math.PI) / 180;
  const oldAnchorX = st.x + ax * Math.cos(oldRad) - ay * Math.sin(oldRad);
  const oldAnchorY = st.y + ax * Math.sin(oldRad) + ay * Math.cos(oldRad);

  // Compute where the anchor would be with new rotation
  const newRad = (newRotation * Math.PI) / 180;
  const newAnchorX = st.x + ax * Math.cos(newRad) - ay * Math.sin(newRad);
  const newAnchorY = st.y + ax * Math.sin(newRad) + ay * Math.cos(newRad);

  // Adjust position to keep anchor stable
  const adjustX = oldAnchorX - newAnchorX;
  const adjustY = oldAnchorY - newAnchorY;

  return {
    rotation: newRotation,
    x: st.x + adjustX,
    y: st.y + adjustY,
  };
}
