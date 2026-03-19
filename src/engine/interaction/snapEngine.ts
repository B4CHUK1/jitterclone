import type { RenderNode } from '@/engine/scene';
import { getWorldCorners, type Vec2 } from '@/engine/transform';

export interface WorldBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  value: number;
  from: number;
  to: number;
  kind: 'edge' | 'center';
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
  snappedX: boolean;
  snappedY: boolean;
}

interface AxisCandidate {
  value: number;
  spanStart: number;
  spanEnd: number;
  kind: 'edge' | 'center';
}

interface AxisBest {
  delta: number;
  distance: number;
  movingSpanStart: number;
  movingSpanEnd: number;
  target: AxisCandidate;
}

export function getRenderNodeBounds(node: RenderNode): WorldBounds {
  const corners = getWorldCorners(node.node.transform, node.worldMatrix);
  return getBoundsFromPoints(corners);
}

export function getBoundsFromPoints(points: readonly Vec2[]): WorldBounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

export function offsetBounds(bounds: WorldBounds, dx: number, dy: number): WorldBounds {
  return {
    left: bounds.left + dx,
    right: bounds.right + dx,
    top: bounds.top + dy,
    bottom: bounds.bottom + dy,
    centerX: bounds.centerX + dx,
    centerY: bounds.centerY + dy,
  };
}

export function resolveBoundsSnapping(
  movingBounds: WorldBounds,
  staticBounds: readonly WorldBounds[],
  threshold: number,
): SnapResult {
  const xCandidates = staticBounds.flatMap((b) => getAxisCandidates(b, 'x'));
  const yCandidates = staticBounds.flatMap((b) => getAxisCandidates(b, 'y'));

  const movingX = getMovingAxisPoints(movingBounds, 'x');
  const movingY = getMovingAxisPoints(movingBounds, 'y');

  const bestX = findBestAxisSnap(movingX, xCandidates, threshold);
  const bestY = findBestAxisSnap(movingY, yCandidates, threshold);

  const guides: SnapGuide[] = [];
  if (bestX) {
    guides.push({
      axis: 'x',
      value: bestX.target.value,
      from: Math.min(bestX.movingSpanStart, bestX.target.spanStart),
      to: Math.max(bestX.movingSpanEnd, bestX.target.spanEnd),
      kind: bestX.target.kind,
    });
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      value: bestY.target.value,
      from: Math.min(bestY.movingSpanStart, bestY.target.spanStart),
      to: Math.max(bestY.movingSpanEnd, bestY.target.spanEnd),
      kind: bestY.target.kind,
    });
  }

  return {
    dx: bestX?.delta ?? 0,
    dy: bestY?.delta ?? 0,
    guides,
    snappedX: Boolean(bestX),
    snappedY: Boolean(bestY),
  };
}

function getAxisCandidates(bounds: WorldBounds, axis: 'x' | 'y'): AxisCandidate[] {
  if (axis === 'x') {
    return [
      {
        value: bounds.left,
        spanStart: bounds.top,
        spanEnd: bounds.bottom,
        kind: 'edge',
      },
      {
        value: bounds.centerX,
        spanStart: bounds.top,
        spanEnd: bounds.bottom,
        kind: 'center',
      },
      {
        value: bounds.right,
        spanStart: bounds.top,
        spanEnd: bounds.bottom,
        kind: 'edge',
      },
    ];
  }

  return [
    {
      value: bounds.top,
      spanStart: bounds.left,
      spanEnd: bounds.right,
      kind: 'edge',
    },
    {
      value: bounds.centerY,
      spanStart: bounds.left,
      spanEnd: bounds.right,
      kind: 'center',
    },
    {
      value: bounds.bottom,
      spanStart: bounds.left,
      spanEnd: bounds.right,
      kind: 'edge',
    },
  ];
}

function getMovingAxisPoints(bounds: WorldBounds, axis: 'x' | 'y') {
  if (axis === 'x') {
    return [
      { value: bounds.left, spanStart: bounds.top, spanEnd: bounds.bottom },
      { value: bounds.centerX, spanStart: bounds.top, spanEnd: bounds.bottom },
      { value: bounds.right, spanStart: bounds.top, spanEnd: bounds.bottom },
    ];
  }

  return [
    { value: bounds.top, spanStart: bounds.left, spanEnd: bounds.right },
    { value: bounds.centerY, spanStart: bounds.left, spanEnd: bounds.right },
    { value: bounds.bottom, spanStart: bounds.left, spanEnd: bounds.right },
  ];
}

function findBestAxisSnap(
  movingPoints: Array<{ value: number; spanStart: number; spanEnd: number }>,
  targets: readonly AxisCandidate[],
  threshold: number,
): AxisBest | null {
  let best: AxisBest | null = null;

  for (const moving of movingPoints) {
    for (const target of targets) {
      const delta = target.value - moving.value;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;

      if (!best || distance < best.distance) {
        best = {
          delta,
          distance,
          movingSpanStart: moving.spanStart,
          movingSpanEnd: moving.spanEnd,
          target,
        };
      }
    }
  }

  return best;
}
