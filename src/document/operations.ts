/**
 * Pure functions to manipulate the document model.
 * These produce new document states (immutable approach).
 */

import type {
  AnimatableProperty,
  AnimatedProperty,
  Document,
  Keyframe,
  NodeStyle,
  NodeType,
  PathPoint,
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
    polygon: overrides.polygon ?? (type === 'polygon' ? { sides: 6 } : undefined),
    star: overrides.star ?? (type === 'star' ? { points: 5, innerRadius: 0.4 } : undefined),
    pathData: overrides.pathData,
    pathClosed: overrides.pathClosed,
    startTime: overrides.startTime ?? 0,
    endTime: overrides.endTime ?? doc.composition.duration,
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
  updates: Partial<Pick<Composition, 'name' | 'width' | 'height' | 'background' | 'duration' | 'fps' | 'workAreaStart' | 'workAreaEnd'>>,
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
  const propertyState = node.animation.properties[property];
  const existing = propertyState.keyframes;
  const filtered = existing.filter((k) => Math.abs(k.time - keyframe.time) > 1e-6);
  const nextTrack = [...filtered, keyframe].sort((a, b) => a.time - b.time);

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        animation: {
          properties: {
            ...node.animation.properties,
            [property]: {
              ...propertyState,
              animated: true,
              keyframes: nextTrack,
            },
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
  const propertyState = node.animation.properties[property];
  const existing = propertyState.keyframes;
  const nextTrack = existing.filter((k) => Math.abs(k.time - time) > 1e-6);

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        animation: {
          properties: {
            ...node.animation.properties,
            [property]: {
              ...propertyState,
              keyframes: nextTrack,
            },
          },
        },
      },
    },
  };
}

export function setNodePropertyAnimation(
  doc: Document,
  nodeId: string,
  property: AnimatableProperty,
  updates: Partial<AnimatedProperty>,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;
  const propertyState = node.animation.properties[property];
  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        animation: {
          properties: {
            ...node.animation.properties,
            [property]: {
              ...propertyState,
              ...updates,
            },
          },
        },
      },
    },
  };
}

export function updateNodeTiming(
  doc: Document,
  nodeId: string,
  updates: { startTime?: number; endTime?: number },
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: {
        ...node,
        startTime: updates.startTime ?? node.startTime,
        endTime: updates.endTime ?? node.endTime,
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

export function reorderRootNodes(doc: Document, orderedIds: string[]): Document {
  // Update the order field on each node to match the new rootNodeIds order
  const updatedNodes = { ...doc.nodes };
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const node = updatedNodes[id];
    if (node && node.order !== i) {
      updatedNodes[id] = { ...node, order: i };
    }
  }
  return { ...doc, rootNodeIds: orderedIds, nodes: updatedNodes };
}

export function getChildren(doc: Document, parentId: string | null): SceneNode[] {
  if (parentId === null) {
    // For root nodes, use rootNodeIds order (authoritative for z-index)
    return doc.rootNodeIds
      .map((id) => doc.nodes[id])
      .filter((n): n is SceneNode => n != null);
  }
  return Object.values(doc.nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

/**
 * Update pathData and pathClosed on a path node.
 */
export function updateNodePathData(
  doc: Document,
  nodeId: string,
  pathData: PathPoint[],
  pathClosed: boolean,
): Document {
  const node = doc.nodes[nodeId];
  if (!node) return doc;
  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: { ...node, pathData, pathClosed },
    },
  };
}

/** Cubic bezier circle approximation constant */
const KAPPA = 0.5522847498;

/**
 * Convert a geometric shape node to a 'path' type with equivalent pathData.
 * Rectangle, ellipse, polygon, star, line → path.
 * Path nodes are returned unchanged.
 */
export function convertNodeToPath(doc: Document, nodeId: string): Document {
  const node = doc.nodes[nodeId];
  if (!node || node.type === 'path' || node.type === 'group') return doc;

  let pathData: PathPoint[];
  let pathClosed: boolean;

  switch (node.type) {
    case 'rectangle': {
      // 4 corners: TL, TR, BR, BL
      pathData = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
      pathClosed = true;
      break;
    }
    case 'ellipse': {
      // 4 cubic bezier points approximating a circle (center 0.5,0.5, radius 0.5)
      const k = KAPPA * 0.5;
      pathData = [
        // Right (0°)
        { x: 1, y: 0.5, handleInX: 0, handleInY: -k, handleOutX: 0, handleOutY: k },
        // Bottom (90°)
        { x: 0.5, y: 1, handleInX: k, handleInY: 0, handleOutX: -k, handleOutY: 0 },
        // Left (180°)
        { x: 0, y: 0.5, handleInX: 0, handleInY: k, handleOutX: 0, handleOutY: -k },
        // Top (270°)
        { x: 0.5, y: 0, handleInX: -k, handleInY: 0, handleOutX: k, handleOutY: 0 },
      ];
      pathClosed = true;
      break;
    }
    case 'polygon': {
      const sides = node.polygon?.sides ?? 6;
      pathData = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        pathData.push({
          x: 0.5 + Math.cos(angle) * 0.5,
          y: 0.5 + Math.sin(angle) * 0.5,
        });
      }
      pathClosed = true;
      break;
    }
    case 'star': {
      const pts = node.star?.points ?? 5;
      const innerRatio = node.star?.innerRadius ?? 0.4;
      const outerR = 0.5;
      const innerR = outerR * innerRatio;
      pathData = [];
      for (let i = 0; i < pts * 2; i++) {
        const angle = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        pathData.push({
          x: 0.5 + Math.cos(angle) * r,
          y: 0.5 + Math.sin(angle) * r,
        });
      }
      pathClosed = true;
      break;
    }
    case 'line': {
      pathData = [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ];
      pathClosed = false;
      break;
    }
    default:
      return doc;
  }

  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [nodeId]: { ...node, type: 'path', pathData, pathClosed },
    },
  };
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
