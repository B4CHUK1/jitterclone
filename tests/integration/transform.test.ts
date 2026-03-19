import { describe, it, expect } from 'vitest';
import { defaultTransform } from '@/engine/transform/transform';
import { beginDrag, updateDrag } from '@/engine/interaction/dragInteraction';
import { beginResize, updateResize } from '@/engine/interaction/resizeInteraction';
import { beginRotate, updateRotate } from '@/engine/interaction/rotateInteraction';
import { vec2 } from '@/engine/transform/math';

describe('Drag interaction', () => {
  it('moves elements by delta', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 50, height: 50 };
    const transforms = new Map([['a', t]]);
    const state = beginDrag(vec2(150, 150), new Set(['a']), (id) => transforms.get(id));

    const updates = updateDrag(state, vec2(200, 250));
    const update = updates.get('a')!;
    expect(update.x).toBe(150); // 100 + (200 - 150)
    expect(update.y).toBe(200); // 100 + (250 - 150)
  });

  it('moves multiple elements together', () => {
    const t1 = { ...defaultTransform(), x: 100, y: 100 };
    const t2 = { ...defaultTransform(), x: 300, y: 200 };
    const transforms = new Map([
      ['a', t1],
      ['b', t2],
    ]);

    const state = beginDrag(vec2(200, 150), new Set(['a', 'b']), (id) => transforms.get(id));
    const updates = updateDrag(state, vec2(210, 160));

    expect(updates.get('a')!.x).toBe(110);
    expect(updates.get('a')!.y).toBe(110);
    expect(updates.get('b')!.x).toBe(310);
    expect(updates.get('b')!.y).toBe(210);
  });
});

describe('Resize interaction', () => {
  it('resizes from right edge', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('right', vec2(300, 150), 'a', t);
    const result = updateResize(state, vec2(350, 150), false);
    expect(result.width).toBe(250);
  });

  it('resizes from bottom edge', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('bottom', vec2(200, 200), 'a', t);
    const result = updateResize(state, vec2(200, 280), false);
    expect(result.height).toBe(180);
  });

  it('enforces minimum size', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('right', vec2(300, 150), 'a', t);
    const result = updateResize(state, vec2(50, 150), false);
    expect(result.width).toBeGreaterThanOrEqual(1);
  });

  it('preserves aspect ratio with shift', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 200, height: 100 };
    const state = beginResize('bottom-right', vec2(200, 100), 'a', t);
    const result = updateResize(state, vec2(300, 100), true);
    expect(result.width! / result.height!).toBeCloseTo(2); // 200/100 ratio
  });
});

describe('Rotate interaction', () => {
  it('rotates element', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100 };
    const state = beginRotate(vec2(100, 50), 'a', t); // start from right edge

    // Move cursor to bottom
    const result = updateRotate(state, vec2(50, 100), false);
    // Should have rotated roughly 90 degrees from right to bottom
    expect(Math.abs(result.rotation)).toBeGreaterThan(0);
  });

  it('snaps rotation to 15 degrees', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100 };
    const state = beginRotate(vec2(100, 50), 'a', t);

    const result = updateRotate(state, vec2(90, 20), true);
    expect(result.rotation % 15).toBeCloseTo(0);
  });
});
