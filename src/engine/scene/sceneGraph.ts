/**
 * Scene graph — converts document nodes to a renderable tree
 * with computed world matrices.
 */

import type { Document, SceneNode } from '@/document/types';
import { getChildren } from '@/document/operations';
import type { Matrix2D } from '@/engine/transform';
import { computeLocalMatrix, computeWorldMatrix, IDENTITY_MATRIX } from '@/engine/transform';

export interface RenderNode {
  readonly node: SceneNode;
  readonly localMatrix: Matrix2D;
  readonly worldMatrix: Matrix2D;
  readonly children: RenderNode[];
}

/**
 * Build a renderable scene tree from the document.
 * Computes all world matrices in a single pass.
 */
export function buildSceneGraph(doc: Document): RenderNode[] {
  function buildSubtree(parentId: string | null, parentWorld: Matrix2D): RenderNode[] {
    const children = getChildren(doc, parentId);
    return children.map((node) => {
      const localMatrix = computeLocalMatrix(node.transform);
      const worldMatrix = computeWorldMatrix(parentWorld, localMatrix);
      return {
        node,
        localMatrix,
        worldMatrix,
        children: buildSubtree(node.id, worldMatrix),
      };
    });
  }

  return buildSubtree(null, IDENTITY_MATRIX);
}

/**
 * Flatten the scene graph for iteration.
 * Returns nodes in render order (back to front).
 */
export function flattenSceneGraph(roots: RenderNode[]): RenderNode[] {
  const result: RenderNode[] = [];
  function walk(nodes: RenderNode[]) {
    for (const rn of nodes) {
      result.push(rn);
      walk(rn.children);
    }
  }
  walk(roots);
  return result;
}

/**
 * Find a RenderNode by id in the scene graph.
 */
export function findRenderNode(roots: RenderNode[], id: string): RenderNode | null {
  for (const rn of roots) {
    if (rn.node.id === id) return rn;
    const found = findRenderNode(rn.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Get a flat map of id → worldMatrix from the scene graph.
 */
export function getWorldMatrixMap(roots: RenderNode[]): Map<string, Matrix2D> {
  const map = new Map<string, Matrix2D>();
  function walk(nodes: RenderNode[]) {
    for (const rn of nodes) {
      map.set(rn.node.id, rn.worldMatrix);
      walk(rn.children);
    }
  }
  walk(roots);
  return map;
}
