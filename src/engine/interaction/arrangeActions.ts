import type { Transform } from '@/engine/transform';
import type { WorldBounds } from '@/engine/interaction/snapEngine';

export type AlignAction =
  | 'left'
  | 'h-center'
  | 'right'
  | 'top'
  | 'v-center'
  | 'bottom';

export type DistributeAction = 'h-spacing' | 'v-spacing';

export interface ArrangableNode {
  id: string;
  bounds: WorldBounds;
  transform: Transform;
}

export function canAlign(nodes: readonly ArrangableNode[]): boolean {
  return nodes.length >= 2;
}

export function canDistribute(nodes: readonly ArrangableNode[], action: DistributeAction): boolean {
  if (nodes.length < 3) return false;
  const selectionBounds = getSelectionBounds(nodes);
  if (action === 'h-spacing') {
    const span = selectionBounds.right - selectionBounds.left;
    const totalSize = nodes.reduce((acc, node) => acc + (node.bounds.right - node.bounds.left), 0);
    return span >= totalSize;
  }
  const span = selectionBounds.bottom - selectionBounds.top;
  const totalSize = nodes.reduce((acc, node) => acc + (node.bounds.bottom - node.bounds.top), 0);
  return span >= totalSize;
}

export function alignNodes(
  nodes: readonly ArrangableNode[],
  action: AlignAction,
): Map<string, Pick<Transform, 'x' | 'y'>> {
  if (!canAlign(nodes)) return new Map();

  const selectionBounds = getSelectionBounds(nodes);
  const updates = new Map<string, Pick<Transform, 'x' | 'y'>>();
  for (const node of nodes) {
    let dx = 0;
    let dy = 0;
    switch (action) {
      case 'left':
        dx = selectionBounds.left - node.bounds.left;
        break;
      case 'h-center':
        dx = selectionBounds.centerX - node.bounds.centerX;
        break;
      case 'right':
        dx = selectionBounds.right - node.bounds.right;
        break;
      case 'top':
        dy = selectionBounds.top - node.bounds.top;
        break;
      case 'v-center':
        dy = selectionBounds.centerY - node.bounds.centerY;
        break;
      case 'bottom':
        dy = selectionBounds.bottom - node.bounds.bottom;
        break;
    }
    updates.set(node.id, {
      x: node.transform.x + dx,
      y: node.transform.y + dy,
    });
  }
  return updates;
}

export function distributeNodes(
  nodes: readonly ArrangableNode[],
  action: DistributeAction,
): Map<string, Pick<Transform, 'x' | 'y'>> {
  if (!canDistribute(nodes, action)) return new Map();
  return action === 'h-spacing'
    ? distributeHorizontally(nodes)
    : distributeVertically(nodes);
}

function distributeHorizontally(nodes: readonly ArrangableNode[]): Map<string, Pick<Transform, 'x' | 'y'>> {
  const sorted = [...nodes].sort((a, b) => a.bounds.left - b.bounds.left);
  const minLeft = sorted[0]?.bounds.left ?? 0;
  const maxRight = sorted[sorted.length - 1]?.bounds.right ?? 0;
  const totalWidth = sorted.reduce((acc, node) => acc + (node.bounds.right - node.bounds.left), 0);
  const gap = (maxRight - minLeft - totalWidth) / (sorted.length - 1);

  let cursor = minLeft;
  const updates = new Map<string, Pick<Transform, 'x' | 'y'>>();
  for (const node of sorted) {
    const width = node.bounds.right - node.bounds.left;
    const dx = cursor - node.bounds.left;
    updates.set(node.id, {
      x: node.transform.x + dx,
      y: node.transform.y,
    });
    cursor += width + gap;
  }
  return updates;
}

function distributeVertically(nodes: readonly ArrangableNode[]): Map<string, Pick<Transform, 'x' | 'y'>> {
  const sorted = [...nodes].sort((a, b) => a.bounds.top - b.bounds.top);
  const minTop = sorted[0]?.bounds.top ?? 0;
  const maxBottom = sorted[sorted.length - 1]?.bounds.bottom ?? 0;
  const totalHeight = sorted.reduce((acc, node) => acc + (node.bounds.bottom - node.bounds.top), 0);
  const gap = (maxBottom - minTop - totalHeight) / (sorted.length - 1);

  let cursor = minTop;
  const updates = new Map<string, Pick<Transform, 'x' | 'y'>>();
  for (const node of sorted) {
    const height = node.bounds.bottom - node.bounds.top;
    const dy = cursor - node.bounds.top;
    updates.set(node.id, {
      x: node.transform.x,
      y: node.transform.y + dy,
    });
    cursor += height + gap;
  }
  return updates;
}

function getSelectionBounds(nodes: readonly ArrangableNode[]): WorldBounds {
  const left = Math.min(...nodes.map((n) => n.bounds.left));
  const right = Math.max(...nodes.map((n) => n.bounds.right));
  const top = Math.min(...nodes.map((n) => n.bounds.top));
  const bottom = Math.max(...nodes.map((n) => n.bounds.bottom));
  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}
