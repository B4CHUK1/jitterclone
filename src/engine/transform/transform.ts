/**
 * Transform system: computes local → world matrices for scene nodes.
 * Handles position, rotation, scale, and anchor point.
 */

import {
  type Matrix2D,
  type Vec2,
  vec2,
  multiplyMatrices,
  makeTranslation,
  makeRotation,
  makeScale,
  degToRad,
  invertMatrix,
  applyMatrix,
  IDENTITY_MATRIX,
} from './math';

export interface Transform {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number; // degrees
  readonly scaleX: number;
  readonly scaleY: number;
  readonly anchorX: number; // 0..1 relative to width
  readonly anchorY: number; // 0..1 relative to height
}

export function defaultTransform(): Transform {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0.5,
    anchorY: 0.5,
  };
}

/**
 * Build the local matrix for a transform.
 * Order: translate(position) → translate(anchor) → rotate → scale → translate(-anchor)
 * The anchor is in local pixel coords relative to element origin.
 */
export function computeLocalMatrix(t: Transform): Matrix2D {
  const ax = t.anchorX * t.width;
  const ay = t.anchorY * t.height;

  // T(position) * T(anchor) * R * S * T(-anchor)
  const toAnchor = makeTranslation(ax, ay);
  const rot = makeRotation(degToRad(t.rotation));
  const sc = makeScale(t.scaleX, t.scaleY);
  const fromAnchor = makeTranslation(-ax, -ay);
  const pos = makeTranslation(t.x, t.y);

  let m = multiplyMatrices(pos, toAnchor);
  m = multiplyMatrices(m, rot);
  m = multiplyMatrices(m, sc);
  m = multiplyMatrices(m, fromAnchor);
  return m;
}

/**
 * Build world matrix given a parent world matrix and the node's local matrix.
 */
export function computeWorldMatrix(parentWorld: Matrix2D, local: Matrix2D): Matrix2D {
  return multiplyMatrices(parentWorld, local);
}

/**
 * Get the four corners of an element in world space.
 */
export function getWorldCorners(t: Transform, worldMatrix: Matrix2D): [Vec2, Vec2, Vec2, Vec2] {
  const w = t.width;
  const h = t.height;
  return [
    applyMatrix(worldMatrix, vec2(0, 0)),
    applyMatrix(worldMatrix, vec2(w, 0)),
    applyMatrix(worldMatrix, vec2(w, h)),
    applyMatrix(worldMatrix, vec2(0, h)),
  ];
}

/**
 * Get the world-space center of an element (anchor point in world coords).
 */
export function getWorldAnchor(t: Transform, worldMatrix: Matrix2D): Vec2 {
  const ax = t.anchorX * t.width;
  const ay = t.anchorY * t.height;
  return applyMatrix(worldMatrix, vec2(ax, ay));
}

/**
 * Convert a world-space point to local coords of an element.
 */
export function worldToLocal(worldMatrix: Matrix2D, worldPoint: Vec2): Vec2 {
  return applyMatrix(invertMatrix(worldMatrix), worldPoint);
}

/**
 * Convert a local-space point to world coords.
 */
export function localToWorld(worldMatrix: Matrix2D, localPoint: Vec2): Vec2 {
  return applyMatrix(worldMatrix, localPoint);
}

/**
 * Compute world matrices for a flat list of nodes, supporting parent chains.
 * parentId of null means root-level.
 */
export function computeAllWorldMatrices(
  nodes: ReadonlyArray<{ id: string; parentId: string | null; transform: Transform }>,
): Map<string, Matrix2D> {
  const worldMatrices = new Map<string, Matrix2D>();
  const localMatrices = new Map<string, Matrix2D>();

  for (const node of nodes) {
    localMatrices.set(node.id, computeLocalMatrix(node.transform));
  }

  function getWorldMatrix(id: string): Matrix2D {
    const cached = worldMatrices.get(id);
    if (cached) return cached;

    const node = nodes.find((n) => n.id === id);
    if (!node) return IDENTITY_MATRIX;

    const local = localMatrices.get(id) ?? IDENTITY_MATRIX;
    let world: Matrix2D;

    if (node.parentId === null) {
      world = local;
    } else {
      const parentWorld = getWorldMatrix(node.parentId);
      world = computeWorldMatrix(parentWorld, local);
    }

    worldMatrices.set(id, world);
    return world;
  }

  for (const node of nodes) {
    getWorldMatrix(node.id);
  }

  return worldMatrices;
}
