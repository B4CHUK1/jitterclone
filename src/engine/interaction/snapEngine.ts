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
  source: 'object' | 'canvas';
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
  snappedX: boolean;
  snappedY: boolean;
  sourceX: 'object' | 'canvas' | null;
  sourceY: 'object' | 'canvas' | null;
}

interface AxisCandidate {
  value: number;
  spanStart: number;
  spanEnd: number;
  kind: 'edge' | 'center';
  source: 'object' | 'canvas';
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
  canvasBounds: WorldBounds | null,
  threshold: number,
): SnapResult {
  const objectXCandidates = staticBounds.flatMap((b) => getAxisCandidates(b, 'x', 'object'));
  const objectYCandidates = staticBounds.flatMap((b) => getAxisCandidates(b, 'y', 'object'));
  const canvasXCandidates = canvasBounds ? getAxisCandidates(canvasBounds, 'x', 'canvas') : [];
  const canvasYCandidates = canvasBounds ? getAxisCandidates(canvasBounds, 'y', 'canvas') : [];

  const movingX = getMovingAxisPoints(movingBounds, 'x');
  const movingY = getMovingAxisPoints(movingBounds, 'y');

  const bestX = resolveAxisWithPriority(
    movingX,
    objectXCandidates,
    canvasXCandidates,
    threshold,
  );
  const bestY = resolveAxisWithPriority(
    movingY,
    objectYCandidates,
    canvasYCandidates,
    threshold,
  );

  const guides: SnapGuide[] = [];
  if (bestX) {
    guides.push({
      axis: 'x',
      value: bestX.target.value,
      from: Math.min(bestX.movingSpanStart, bestX.target.spanStart),
      to: Math.max(bestX.movingSpanEnd, bestX.target.spanEnd),
      kind: bestX.target.kind,
      source: bestX.target.source,
    });
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      value: bestY.target.value,
      from: Math.min(bestY.movingSpanStart, bestY.target.spanStart),
      to: Math.max(bestY.movingSpanEnd, bestY.target.spanEnd),
      kind: bestY.target.kind,
      source: bestY.target.source,
    });
  }

  return {
    dx: bestX?.delta ?? 0,
    dy: bestY?.delta ?? 0,
    guides,
    snappedX: Boolean(bestX),
    snappedY: Boolean(bestY),
    sourceX: bestX?.target.source ?? null,
    sourceY: bestY?.target.source ?? null,
  };
}

export function getCanvasBounds(width: number, height: number): WorldBounds {
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    centerX: width / 2,
    centerY: height / 2,
  };
}

function getAxisCandidates(
  bounds: WorldBounds,
  axis: 'x' | 'y',
  source: 'object' | 'canvas',
): AxisCandidate[] {
  if (axis === 'x') {
    return [
      {
        value: bounds.left,
        spanStart: bounds.top,
        spanEnd: bounds.bottom,
        kind: 'edge',
        source,
      },
      {
        value: bounds.centerX,
        spanStart: bounds.top,
        spanEnd: bounds.bottom,
        kind: 'center',
        source,
      },
      {
        value: bounds.right,
        spanStart: bounds.top,
        spanEnd: bounds.bottom,
        kind: 'edge',
        source,
      },
    ];
  }

  return [
    {
      value: bounds.top,
      spanStart: bounds.left,
      spanEnd: bounds.right,
      kind: 'edge',
      source,
    },
    {
      value: bounds.centerY,
      spanStart: bounds.left,
      spanEnd: bounds.right,
      kind: 'center',
      source,
    },
    {
      value: bounds.bottom,
      spanStart: bounds.left,
      spanEnd: bounds.right,
      kind: 'edge',
      source,
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

function resolveAxisWithPriority(
  movingPoints: Array<{ value: number; spanStart: number; spanEnd: number }>,
  objectTargets: readonly AxisCandidate[],
  canvasTargets: readonly AxisCandidate[],
  threshold: number,
): AxisBest | null {
  const bestObject = findBestAxisSnap(movingPoints, objectTargets, threshold);
  const bestCanvas = findBestAxisSnap(movingPoints, canvasTargets, threshold);
  if (!bestObject) return bestCanvas;
  if (!bestCanvas) return bestObject;

  const distanceDelta = bestObject.distance - bestCanvas.distance;
  const SNAP_STABILITY_EPS = 0.5;
  if (Math.abs(distanceDelta) <= SNAP_STABILITY_EPS) {
    return bestObject;
  }
  return distanceDelta < 0 ? bestObject : bestCanvas;
}
