/**
 * Pure functions to manipulate the document model.
 * These produce new document states (immutable approach).
 */

import type {
  AnimatableProperty,
  Document,
  Keyframe,
  NodeStyle,
  NodeType,
  SceneNode,
  Composition,
} from './types';
import { generateId, defaultNodeAnimation, defaultStyle } from './types';
import { defaultTransform, type Transform } from '@/engine/transform';

export function addNode(
  doc: Document,
  type: NodeType,
  overrides: Partial<SceneNode> = {},
): { doc: Document; nodeId: string } {
  const id = generateId();
  const parentId = overrides.parentId ?? null;

  const siblingCount = parentId
    ? Object.values(doc.nodes).filter((n) => n.parentId === parentId).length
    : doc.rootNodeIds.length;

  const node: SceneNode = {
    id,
    type,
    name: overrides.name ?? `${type} ${siblingCount + 1}`,
    parentId,
    order: siblingCount,
    transform: overrides.transform ?? defaultTransform(),
    style: overrides.style ?? defaultStyle(),
    visible: overrides.visible ?? true,
    locked: overrides.locked ?? false,
    animation: overrides.animation ?? defaultNodeAnimation(),
  };

  const newNodes = { ...doc.nodes, [id]: node };
  const newRootIds = parentId === null ? [...doc.rootNodeIds, id] : doc.rootNodeIds;

  return {
    doc: { ...doc, nodes: newNodes, rootNodeIds: newRootIds },
    nodeId: id,
  };
}

export function removeNode(doc: Document, nodeId: string): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;

  // Collect all descendants
  const toRemove = new Set<string>();
  function collectDescendants(id: string) {
    toRemove.add(id);
    for (const n of Object.values(doc.nodes)) {
      if (n.parentId === id) {
        collectDescendants(n.id);
      }
    }
  }
  collectDescendants(nodeId);

  const newNodes = { ...doc.nodes };
  for (const id of toRemove) {
    delete newNodes[id];
  }

  const newRootIds = doc.rootNodeIds.filter((id) => !toRemove.has(id));

  return { ...doc, nodes: newNodes, rootNodeIds: newRootIds };
}

export function updateNodeTransform(
  doc: Document,
  nodeId: string,
  updates: Partial<Transform>,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        transform: { ...node.transform, ...updates },
      },
    },
  };
}

export function updateManyNodeTransforms(
  doc: Document,
  updatesById: Map<string, Partial<Transform>>,
): Document {
  if (updatesById.size === 0) return doc;

  const updatedNodes = { ...doc.nodes };
  let changed = false;
  for (const [nodeId, updates] of updatesById) {
    const node = updatedNodes[nodeId];
    if (!node) continue;
    updatedNodes[nodeId] = {
      ...node,
      transform: { ...node.transform, ...updates },
    };
    changed = true;
  }

  return changed ? { ...doc, nodes: updatedNodes } : doc;
}

export function updateNodeStyle(
  doc: Document,
  nodeId: string,
  updates: Partial<NodeStyle>,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        style: { ...node.style, ...updates },
      },
    },
  };
}

export function updateNodeProps(
  doc: Document,
  nodeId: string,
  updates: Partial<Pick<SceneNode, 'name' | 'visible' | 'locked'>>,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: { ...node, ...updates },
    },
  };
}

export function updateComposition(
  doc: Document,
  updates: Partial<Pick<Composition, 'name' | 'width' | 'height' | 'background' | 'duration' | 'fps'>>,
): Document {
  const nextComposition = {
    ...doc.composition,
    ...updates,
  };
  return {
    ...doc,
    composition: nextComposition,
    width: nextComposition.width,
    height: nextComposition.height,
  };
}

export function setNodeKeyframe(
  doc: Document,
  nodeId: string,
  property: AnimatableProperty,
  keyframe: Keyframe,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;
  const existing = node.animation.tracks[property] ?? [];
  const filtered = existing.filter((k) => Math.abs(k.time - keyframe.time) > 1e-6);
  const nextTrack = [...filtered, keyframe].sort((a, b) => a.time - b.time);

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        animation: {
          tracks: {
            ...node.animation.tracks,
            [property]: nextTrack,
          },
        },
      },
    },
  };
}

export function removeNodeKeyframe(
  doc: Document,
  nodeId: string,
  property: AnimatableProperty,
  time: number,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;
  const existing = node.animation.tracks[property] ?? [];
  const nextTrack = existing.filter((k) => Math.abs(k.time - time) > 1e-6);

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        animation: {
          tracks: {
            ...node.animation.tracks,
            [property]: nextTrack,
          },
        },
      },
    },
  };
}

export function reparentNode(
  doc: Document,
  nodeId: string,
  newParentId: string | null,
  order: number,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;

  // Remove from old parent's root list if was root
  let newRootIds = doc.rootNodeIds;
  if (node.parentId === null && newParentId !== null) {
    newRootIds = newRootIds.filter((id) => id !== nodeId);
  } else if (node.parentId !== null && newParentId === null) {
    newRootIds = [...newRootIds, nodeId];
  }

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: { ...node, parentId: newParentId, order },
    },
    rootNodeIds: newRootIds,
  };
}

export function getChildren(doc: Document, parentId: string | null): SceneNode[] {
  return Object.values(doc.nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function getAncestors(doc: Document, nodeId: string): string[] {
  const ancestors: string[] = [];
  let current = doc.nodes[nodeId];
  while (current?.parentId) {
    ancestors.push(current.parentId);
    current = doc.nodes[current.parentId];
  }
  return ancestors;
}
