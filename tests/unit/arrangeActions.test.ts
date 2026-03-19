import { describe, expect, it } from 'vitest';
import { alignNodes, distributeNodes } from '@/engine/interaction/arrangeActions';
import type { ArrangableNode } from '@/engine/interaction/arrangeActions';
import { defaultTransform } from '@/engine/transform/transform';

function node(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): ArrangableNode {
  return {
    id,
    transform: { ...defaultTransform(), x, y, width, height },
    bounds: {
      left: x,
      right: x + width,
      top: y,
      bottom: y + height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    },
  };
}

describe('arrange actions', () => {
  it('aligns selected nodes to the same left edge', () => {
    const nodes = [node('a', 10, 20, 50, 40), node('b', 100, 30, 30, 20)];
    const updates = alignNodes(nodes, 'left');
    expect(updates.get('a')).toEqual({ x: 10, y: 20 });
    expect(updates.get('b')).toEqual({ x: 10, y: 30 });
  });

  it('distributes horizontal spacing by bounding-box gaps', () => {
    const nodes = [node('a', 0, 0, 20, 20), node('b', 80, 0, 10, 20), node('c', 140, 0, 30, 20)];
    const updates = distributeNodes(nodes, 'h-spacing');
    const ax = updates.get('a')?.x ?? 0;
    const bx = updates.get('b')?.x ?? 0;
    const cx = updates.get('c')?.x ?? 0;
    const gapAB = bx - (ax + 20);
    const gapBC = cx - (bx + 10);
    expect(ax).toBe(0);
    expect(cx).toBe(140);
    expect(gapAB).toBeCloseTo(gapBC);
  });

  it('distributes vertical spacing by bounding-box gaps', () => {
    const nodes = [node('a', 0, 0, 20, 20), node('b', 0, 40, 20, 30), node('c', 0, 120, 20, 10)];
    const updates = distributeNodes(nodes, 'v-spacing');
    const ay = updates.get('a')?.y ?? 0;
    const by = updates.get('b')?.y ?? 0;
    const cy = updates.get('c')?.y ?? 0;
    const gapAB = by - (ay + 20);
    const gapBC = cy - (by + 30);
    expect(ay).toBe(0);
    expect(cy).toBe(120);
    expect(gapAB).toBeCloseTo(gapBC);
  });
});
