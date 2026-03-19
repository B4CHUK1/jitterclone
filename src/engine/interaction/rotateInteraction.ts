/**
 * Rotate interaction logic.
 * Uses a shared pivot and matrix-based anchor solving so rotation behavior
 * stays consistent for all node types (rectangle, ellipse, groups, etc.).
 */

import type { Vec2 } from '@/engine/transform';
import type { Transform } from '@/engine/transform/transform';
import { radToDeg, degToRad, normalizeAngle, snapAngle } from '@/engine/transform';
import {
  getWorldAnchor,
  getWorldCorners,
  computeLocalMatrix,
  applyMatrix,
  invertMatrix,
  multiplyMatrices,
  rotateVec2Around,
} from '@/engine/transform';
import type { Matrix2D } from '@/engine/transform/math';

export interface RotateTarget {
  readonly nodeId: string;
  readonly transform: Transform;
  readonly worldMatrix?: Matrix2D;
}

interface RotateNodeState {
  readonly nodeId: string;
  readonly startTransform: Transform;
  readonly startAnchorWorld: Vec2;
  readonly parentWorldInverse: Matrix2D;
}

export interface RotateState {
  readonly targets: readonly RotateNodeState[];
  readonly pivotWorld: Vec2;
  readonly startAngleRad: number;
  readonly primaryNodeId: string;
}

export function beginRotate(
  worldPoint: Vec2,
  targets: readonly RotateTarget[],
): RotateState {
  const resolvedTargets = targets.map<RotateNodeState>((target) => {
    const local = computeLocalMatrix(target.transform);
    const world = target.worldMatrix ?? local;
    const anchorWorld = getWorldAnchor(target.transform, world);

    // world = parent * local  =>  parent = world * inverse(local)
    const parentWorld = multiplyMatrices(world, invertMatrix(local));
    const parentWorldInverse = invertMatrix(parentWorld);

    return {
      nodeId: target.nodeId,
      startTransform: target.transform,
      startAnchorWorld: anchorWorld,
      parentWorldInverse,
    };
  });

  const pivotWorld = computePivotWorld(targets);
  const startAngleRad = Math.atan2(
    worldPoint.y - pivotWorld.y,
    worldPoint.x - pivotWorld.x,
  );

  return {
    targets: resolvedTargets,
    pivotWorld,
    startAngleRad,
    primaryNodeId: resolvedTargets[0]?.nodeId ?? '',
  };
}

export function updateRotate(
  state: RotateState,
  currentWorldPoint: Vec2,
  snap: boolean,
): { updates: Map<string, Partial<Transform>>; primaryRotation: number } {
  const currentAngleRad = Math.atan2(
    currentWorldPoint.y - state.pivotWorld.y,
    currentWorldPoint.x - state.pivotWorld.x,
  );

  let deltaAngleDeg = radToDeg(currentAngleRad - state.startAngleRad);
  if (snap) {
    deltaAngleDeg = snapAngle(deltaAngleDeg, 15);
  }
  const deltaAngleRad = degToRad(deltaAngleDeg);

  const updates = new Map<string, Partial<Transform>>();

  for (const target of state.targets) {
    const start = target.startTransform;
    const ax = start.anchorX * start.width;
    const ay = start.anchorY * start.height;

    const rotatedAnchorWorld = rotateVec2Around(
      target.startAnchorWorld,
      state.pivotWorld,
      deltaAngleRad,
    );

    const anchorInParent = applyMatrix(target.parentWorldInverse, rotatedAnchorWorld);
    const x = anchorInParent.x - ax;
    const y = anchorInParent.y - ay;

    updates.set(target.nodeId, {
      x,
      y,
      rotation: normalizeAngle(start.rotation + deltaAngleDeg),
    });
  }

  const primaryRotation =
    updates.get(state.primaryNodeId)?.rotation
    ?? state.targets[0]?.startTransform.rotation
    ?? 0;

  return {
    updates,
    primaryRotation,
  };
}

function computePivotWorld(targets: readonly RotateTarget[]): Vec2 {
  if (targets.length === 1) {
    const target = targets[0]!;
    const world = target.worldMatrix ?? computeLocalMatrix(target.transform);
    return getWorldAnchor(target.transform, world);
  }

  const points: Vec2[] = [];
  for (const target of targets) {
    const world = target.worldMatrix ?? computeLocalMatrix(target.transform);
    points.push(...getWorldCorners(target.transform, world));
  }

  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}
