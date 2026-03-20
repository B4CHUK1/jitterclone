import { describe, it, expect } from 'vitest';
import { defaultTransform } from '@/engine/transform/transform';
import { beginDrag, updateDrag } from '@/engine/interaction/dragInteraction';
import { beginResize, updateResize } from '@/engine/interaction/resizeInteraction';
import { resolveResizeSnap } from '@/engine/interaction/resizeSnap';
import { beginRotate, updateRotate } from '@/engine/interaction/rotateInteraction';
import { vec2 } from '@/engine/transform/math';
import { computeLocalMatrix, getWorldAnchor, getWorldCorners, localToWorld } from '@/engine/transform';
import { getBoundsFromPoints, getCanvasBounds } from '@/engine/interaction/snapEngine';

const NO_MOD = { shift: false, alt: false };

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
    const result = updateResize(state, vec2(350, 150), NO_MOD);
    expect(result.width).toBe(250);
  });

  it('resizes from bottom edge', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('bottom', vec2(200, 200), 'a', t);
    const result = updateResize(state, vec2(200, 280), NO_MOD);
    expect(result.height).toBe(180);
  });

  it('resizes from left edge (shifts position)', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('left', vec2(100, 150), 'a', t);
    const result = updateResize(state, vec2(50, 150), NO_MOD);
    expect(result.width).toBe(250);
    expect(result.x).toBe(50);
  });

  it('resizes from top edge (shifts position)', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('top', vec2(200, 100), 'a', t);
    const result = updateResize(state, vec2(200, 60), NO_MOD);
    expect(result.height).toBe(140);
    expect(result.y).toBe(60);
  });

  it('enforces minimum size', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('right', vec2(300, 150), 'a', t);
    const result = updateResize(state, vec2(50, 150), NO_MOD);
    expect(result.width).toBeGreaterThanOrEqual(1);
  });

  it('preserves aspect ratio with shift', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 200, height: 100 };
    const state = beginResize('bottom-right', vec2(200, 100), 'a', t);
    const result = updateResize(state, vec2(300, 100), { shift: true, alt: false });
    expect(result.width! / result.height!).toBeCloseTo(2);
  });

  it('resizes from center with alt', () => {
    const t = { ...defaultTransform(), x: 100, y: 100, width: 200, height: 100 };
    const state = beginResize('right', vec2(300, 150), 'a', t);
    const result = updateResize(state, vec2(350, 150), { shift: false, alt: true });
    // Alt: delta is doubled, position shifts to keep center fixed
    expect(result.width).toBe(300); // 200 + 50*2
    expect(result.x).toBe(50);     // 100 - 50
  });

  it('resize from corner', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 200, height: 100 };
    const state = beginResize('bottom-right', vec2(200, 100), 'a', t);
    const result = updateResize(state, vec2(250, 130), NO_MOD);
    expect(result.width).toBe(250);
    expect(result.height).toBe(130);
  });

  it('keeps opposite corner fixed when resizing a rotated element', () => {
    const t = {
      ...defaultTransform(),
      x: 220,
      y: 180,
      width: 180,
      height: 120,
      rotation: 15,
      anchorX: 0.5,
      anchorY: 0.5,
    };
    const startMatrix = computeLocalMatrix(t);
    const startHandle = localToWorld(startMatrix, vec2(t.width, t.height));
    const fixedBefore = localToWorld(startMatrix, vec2(0, 0));

    const state = beginResize('bottom-right', startHandle, 'a', t);
    const result = updateResize(
      state,
      vec2(startHandle.x + 40, startHandle.y + 20),
      NO_MOD,
    );

    const after = { ...t, ...result };
    const afterMatrix = computeLocalMatrix(after);
    const fixedAfter = localToWorld(afterMatrix, vec2(0, 0));
    expect(fixedAfter.x).toBeCloseTo(fixedBefore.x, 6);
    expect(fixedAfter.y).toBeCloseTo(fixedBefore.y, 6);
  });

  it('keeps opposite edge midpoint fixed for rotated edge resize', () => {
    const t = {
      ...defaultTransform(),
      x: 120,
      y: 90,
      width: 240,
      height: 160,
      rotation: 15,
      anchorX: 0.3,
      anchorY: 0.6,
    };
    const startMatrix = computeLocalMatrix(t);
    const startHandle = localToWorld(startMatrix, vec2(t.width, t.height / 2));
    const fixedBefore = localToWorld(startMatrix, vec2(0, t.height / 2));

    const state = beginResize('right', startHandle, 'a', t);
    const result = updateResize(
      state,
      vec2(startHandle.x + 35, startHandle.y - 5),
      NO_MOD,
    );

    const after = { ...t, ...result };
    const afterMatrix = computeLocalMatrix(after);
    const fixedAfter = localToWorld(afterMatrix, vec2(0, after.height / 2));
    expect(fixedAfter.x).toBeCloseTo(fixedBefore.x, 6);
    expect(fixedAfter.y).toBeCloseTo(fixedBefore.y, 6);
  });

  it('keeps opposite corner fixed when rotated resize snaps', () => {
    const t = {
      ...defaultTransform(),
      x: 220,
      y: 180,
      width: 180,
      height: 120,
      rotation: 15,
      anchorX: 0.5,
      anchorY: 0.5,
    };
    const startMatrix = computeLocalMatrix(t);
    const startHandle = localToWorld(startMatrix, vec2(t.width, t.height));
    const fixedBefore = localToWorld(startMatrix, vec2(0, 0));
    const state = beginResize('bottom-right', startHandle, 'a', t);

    const pointer = vec2(startHandle.x + 40, startHandle.y + 20);
    const proposed = updateResize(state, pointer, NO_MOD);
    const proposedTransform = { ...t, ...proposed };
    const proposedBounds = getBoundsFromPoints(
      getWorldCorners(proposedTransform, computeLocalMatrix(proposedTransform)),
    );
    const staticTarget = {
      left: proposedBounds.right + 10,
      right: proposedBounds.right + 110,
      top: proposedBounds.top - 50,
      bottom: proposedBounds.bottom + 50,
      centerX: proposedBounds.right + 60,
      centerY: (proposedBounds.top + proposedBounds.bottom) / 2,
    };

    const snapped = resolveResizeSnap(
      state,
      pointer,
      NO_MOD,
      proposed,
      [staticTarget],
      getCanvasBounds(2000, 2000),
      12,
    );

    expect(snapped.guides.length).toBeGreaterThan(0);
    const after = { ...t, ...snapped.transform };
    const afterMatrix = computeLocalMatrix(after);
    const fixedAfter = localToWorld(afterMatrix, vec2(0, 0));
    expect(fixedAfter.x).toBeCloseTo(fixedBefore.x, 6);
    expect(fixedAfter.y).toBeCloseTo(fixedBefore.y, 6);
  });
});

describe('Rotate interaction', () => {
  it('rotates element', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100 };
    const state = beginRotate(vec2(100, 50), [{ nodeId: 'a', transform: t }]);

    const result = updateRotate(state, vec2(50, 100), false);
    expect(Math.abs(result.primaryRotation)).toBeGreaterThan(0);
  });

  it('snaps rotation to 15 degrees', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100 };
    const state = beginRotate(vec2(100, 50), [{ nodeId: 'a', transform: t }]);

    const result = updateRotate(state, vec2(90, 20), true);
    expect(result.primaryRotation % 15).toBeCloseTo(0);
  });

  it('keeps world anchor stable while rotating (no x/y drift)', () => {
    const t = {
      ...defaultTransform(),
      x: 300,
      y: 200,
      width: 240,
      height: 140,
      anchorX: 0.25,
      anchorY: 0.75,
      rotation: 10,
    };
    const startMatrix = computeLocalMatrix(t);
    const startAnchor = getWorldAnchor(t, startMatrix);

    const state = beginRotate(vec2(startAnchor.x + 80, startAnchor.y), [{ nodeId: 'a', transform: t }]);
    const result = updateRotate(state, vec2(startAnchor.x, startAnchor.y + 100), false);

    const update = result.updates.get('a');
    expect(update).toBeDefined();
    expect(update).toHaveProperty('x');
    expect(update).toHaveProperty('y');

    const transformed = { ...t, ...update };
    const afterMatrix = computeLocalMatrix(transformed);
    const afterAnchor = getWorldAnchor(transformed, afterMatrix);

    expect(afterAnchor.x).toBeCloseTo(startAnchor.x, 6);
    expect(afterAnchor.y).toBeCloseTo(startAnchor.y, 6);
  });

  it('rotates multiple elements around shared selection center', () => {
    const a = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100 };
    const b = { ...defaultTransform(), x: 200, y: 0, width: 100, height: 100 };

    const state = beginRotate(
      vec2(250, 50),
      [
        { nodeId: 'a', transform: a },
        { nodeId: 'b', transform: b },
      ],
    );

    const result = updateRotate(state, vec2(150, 150), false);
    const updateA = result.updates.get('a')!;
    const updateB = result.updates.get('b')!;

    expect(updateA.x).not.toBe(a.x);
    expect(updateB.x).not.toBe(b.x);
    expect(updateA.rotation).toBeCloseTo(updateB.rotation ?? 0, 6);
  });
});
