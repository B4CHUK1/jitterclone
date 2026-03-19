import { describe, expect, it } from 'vitest';
import { getCanvasBounds, resolveBoundsSnapping, type WorldBounds } from '@/engine/interaction/snapEngine';

function bounds(left: number, top: number, right: number, bottom: number): WorldBounds {
  return {
    left,
    top,
    right,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

describe('snap engine canvas support', () => {
  it('snaps moving bounds to canvas edges', () => {
    const moving = bounds(3, 50, 103, 150);
    const snap = resolveBoundsSnapping(moving, [], getCanvasBounds(500, 400), 8);
    expect(snap.dx).toBe(-3);
    expect(snap.sourceX).toBe('canvas');
    expect(snap.guides[0]?.source).toBe('canvas');
  });

  it('snaps moving bounds to canvas center lines', () => {
    const moving = bounds(190, 150, 290, 250);
    const snap = resolveBoundsSnapping(moving, [], getCanvasBounds(500, 400), 12);
    expect(snap.dx).toBe(10);
    expect(snap.dy).toBe(0);
    expect(snap.sourceX).toBe('canvas');
  });

  it('prefers object snapping on near-equal distances', () => {
    const moving = bounds(97.8, 0, 147.8, 50);
    const objectTarget = bounds(100, 0, 150, 50);
    const snap = resolveBoundsSnapping(moving, [objectTarget], getCanvasBounds(200, 200), 8);
    expect(snap.dx).toBeCloseTo(2.2);
    expect(snap.sourceX).toBe('object');
  });
});
