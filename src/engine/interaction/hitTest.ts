/**
 * Hit testing — determine what's under a screen point.
 * Works on the scene graph with world matrices, independent of renderer.
 */

import type { Vec2 } from '@/engine/transform';
import { worldToLocal } from '@/engine/transform';
import { getResizeCursorFromDirection } from './resizeCursor';
import type { RenderNode } from '@/engine/scene';
import { flattenSceneGraph } from '@/engine/scene';
import type { BoundingBox } from '@/engine/transform/math';
import { boundsFromPoints, boundsIntersect, getWorldCorners } from '@/engine/transform';

/**
 * Find the topmost node at a world-space point.
 * Tests in reverse render order (front to back).
 */
export function hitTestPoint(sceneRoots: RenderNode[], worldPoint: Vec2): RenderNode | null {
  const flat = flattenSceneGraph(sceneRoots);

  // Iterate back-to-front (last = topmost)
  for (let i = flat.length - 1; i >= 0; i--) {
    const rn = flat[i]!;
    if (!rn.node.visible || rn.node.locked) continue;
    if (rn.node.type === 'group') continue; // groups don't have their own fill

    const local = worldToLocal(rn.worldMatrix, worldPoint);
    const { width, height } = rn.node.transform;

    if (local.x >= 0 && local.x <= width && local.y >= 0 && local.y <= height) {
      return rn;
    }
  }

  return null;
}

/**
 * Find all nodes whose world-space bounding box intersects a selection rectangle.
 * The rect is in world coordinates.
 */
export function hitTestRect(sceneRoots: RenderNode[], rect: BoundingBox): RenderNode[] {
  const flat = flattenSceneGraph(sceneRoots);
  const results: RenderNode[] = [];

  for (const rn of flat) {
    if (!rn.node.visible || rn.node.locked) continue;
    if (rn.node.type === 'group') continue;

    const corners = getWorldCorners(rn.node.transform, rn.worldMatrix);
    const aabb = boundsFromPoints([...corners]);

    if (boundsIntersect(aabb, rect)) {
      results.push(rn);
    }
  }

  return results;
}

/**
 * Determine which resize/rotate handle is under the cursor, if any.
 * Works in screen space for consistent handle sizes regardless of zoom.
 */
export type HandleType =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'rotate-top-left'
  | 'rotate-top-right'
  | 'rotate-bottom-right'
  | 'rotate-bottom-left';

export interface HandleHit {
  type: HandleType;
  cursor: string;
}

const HANDLE_SIZE = 8;
const HANDLE_HIT_AREA = 12;
const ROTATION_OFFSET = 20;
const ROTATION_HIT_AREA = 18;

export function hitTestHandles(
  screenCorners: [Vec2, Vec2, Vec2, Vec2],
  screenPoint: Vec2,
): HandleHit | null {
  const [tl, tr, br, bl] = screenCorners;
  const center = centerPoint(screenCorners);

  // Edge midpoints
  const top = midpoint(tl, tr);
  const right = midpoint(tr, br);
  const bottom = midpoint(br, bl);
  const left = midpoint(bl, tl);

  // Rotation handles (offset outward from corners)
  const rotationCorners = getRotationCornerPositions(screenCorners);

  // Check rotation handles first (they're outside the box)
  const rotHandles: { pos: Vec2; type: HandleType; cursor: string }[] = [
    { pos: rotationCorners[0], type: 'rotate-top-left', cursor: 'crosshair' },
    { pos: rotationCorners[1], type: 'rotate-top-right', cursor: 'crosshair' },
    { pos: rotationCorners[2], type: 'rotate-bottom-right', cursor: 'crosshair' },
    { pos: rotationCorners[3], type: 'rotate-bottom-left', cursor: 'crosshair' },
  ];

  for (const h of rotHandles) {
    if (distance(screenPoint, h.pos) <= ROTATION_HIT_AREA) {
      return { type: h.type, cursor: h.cursor };
    }
  }

  // Check corner handles
  const cornerHandles: { pos: Vec2; type: HandleType; cursor: string }[] = [
    {
      pos: tl,
      type: 'top-left',
      cursor: getResizeCursorFromDirection({ x: tl.x - center.x, y: tl.y - center.y }),
    },
    {
      pos: tr,
      type: 'top-right',
      cursor: getResizeCursorFromDirection({ x: tr.x - center.x, y: tr.y - center.y }),
    },
    {
      pos: br,
      type: 'bottom-right',
      cursor: getResizeCursorFromDirection({ x: br.x - center.x, y: br.y - center.y }),
    },
    {
      pos: bl,
      type: 'bottom-left',
      cursor: getResizeCursorFromDirection({ x: bl.x - center.x, y: bl.y - center.y }),
    },
  ];

  for (const h of cornerHandles) {
    if (distance(screenPoint, h.pos) <= HANDLE_HIT_AREA) {
      return { type: h.type, cursor: h.cursor };
    }
  }

  // Check edge handles
  const edgeHandles: { pos: Vec2; type: HandleType; cursor: string }[] = [
    {
      pos: top,
      type: 'top',
      cursor: getResizeCursorFromDirection({ x: top.x - center.x, y: top.y - center.y }),
    },
    {
      pos: right,
      type: 'right',
      cursor: getResizeCursorFromDirection({ x: right.x - center.x, y: right.y - center.y }),
    },
    {
      pos: bottom,
      type: 'bottom',
      cursor: getResizeCursorFromDirection({ x: bottom.x - center.x, y: bottom.y - center.y }),
    },
    {
      pos: left,
      type: 'left',
      cursor: getResizeCursorFromDirection({ x: left.x - center.x, y: left.y - center.y }),
    },
  ];

  for (const h of edgeHandles) {
    if (distance(screenPoint, h.pos) <= HANDLE_HIT_AREA) {
      return { type: h.type, cursor: h.cursor };
    }
  }

  return null;
}

function centerPoint([tl, tr, br, bl]: [Vec2, Vec2, Vec2, Vec2]): Vec2 {
  return {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getRotationCornerPositions(corners: [Vec2, Vec2, Vec2, Vec2]): [Vec2, Vec2, Vec2, Vec2] {
  const [tl, tr, br, bl] = corners;
  const center = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };

  function offsetFromCenter(corner: Vec2): Vec2 {
    const dx = corner.x - center.x;
    const dy = corner.y - center.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return corner;
    const factor = (len + ROTATION_OFFSET) / len;
    return {
      x: center.x + dx * factor,
      y: center.y + dy * factor,
    };
  }

  return [
    offsetFromCenter(tl),
    offsetFromCenter(tr),
    offsetFromCenter(br),
    offsetFromCenter(bl),
  ];
}

// Re-export constants for overlay rendering
export { HANDLE_SIZE, HANDLE_HIT_AREA, ROTATION_OFFSET, ROTATION_HIT_AREA };
