import { describe, it, expect } from 'vitest';
import {
  vec2,
  addVec2,
  subVec2,
  scaleVec2,
  lengthVec2,
  normalizeVec2,
  dotVec2,
  distanceVec2,
  lerpVec2,
  rotateVec2Around,
  degToRad,
  radToDeg,
  normalizeAngle,
  snapAngle,
  IDENTITY_MATRIX,
  makeTranslation,
  makeRotation,
  makeScale,
  multiplyMatrices,
  invertMatrix,
  applyMatrix,
  decomposeMatrix,
  boundsFromPoints,
  pointInBounds,
  expandBounds,
  boundsIntersect,
} from '@/engine/transform/math';

describe('Vec2 operations', () => {
  it('creates vectors', () => {
    const v = vec2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('adds vectors', () => {
    const r = addVec2(vec2(1, 2), vec2(3, 4));
    expect(r).toEqual({ x: 4, y: 6 });
  });

  it('subtracts vectors', () => {
    const r = subVec2(vec2(5, 7), vec2(3, 4));
    expect(r).toEqual({ x: 2, y: 3 });
  });

  it('scales vectors', () => {
    const r = scaleVec2(vec2(2, 3), 4);
    expect(r).toEqual({ x: 8, y: 12 });
  });

  it('computes length', () => {
    expect(lengthVec2(vec2(3, 4))).toBe(5);
  });

  it('normalizes vectors', () => {
    const n = normalizeVec2(vec2(3, 4));
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
  });

  it('normalizes zero vector', () => {
    const n = normalizeVec2(vec2(0, 0));
    expect(n).toEqual({ x: 0, y: 0 });
  });

  it('computes dot product', () => {
    expect(dotVec2(vec2(1, 2), vec2(3, 4))).toBe(11);
  });

  it('computes distance', () => {
    expect(distanceVec2(vec2(0, 0), vec2(3, 4))).toBe(5);
  });

  it('interpolates linearly', () => {
    const r = lerpVec2(vec2(0, 0), vec2(10, 20), 0.5);
    expect(r).toEqual({ x: 5, y: 10 });
  });

  it('rotates around center', () => {
    const p = rotateVec2Around(vec2(1, 0), vec2(0, 0), Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });
});

describe('Angle utilities', () => {
  it('converts degrees to radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
  });

  it('converts radians to degrees', () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
  });

  it('normalizes angles', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(270)).toBe(-90);
    expect(normalizeAngle(-270)).toBe(90);
  });

  it('snaps angles', () => {
    expect(snapAngle(14, 15)).toBe(15);
    expect(snapAngle(7, 15)).toBe(0);
    expect(snapAngle(23, 15)).toBe(30);
    expect(snapAngle(38, 15)).toBe(45);
  });
});

describe('Matrix operations', () => {
  it('identity matrix leaves points unchanged', () => {
    const p = applyMatrix(IDENTITY_MATRIX, vec2(5, 7));
    expect(p).toEqual({ x: 5, y: 7 });
  });

  it('translation matrix moves points', () => {
    const m = makeTranslation(10, 20);
    const p = applyMatrix(m, vec2(5, 7));
    expect(p).toEqual({ x: 15, y: 27 });
  });

  it('scale matrix scales points', () => {
    const m = makeScale(2, 3);
    const p = applyMatrix(m, vec2(5, 7));
    expect(p).toEqual({ x: 10, y: 21 });
  });

  it('rotation matrix rotates points', () => {
    const m = makeRotation(Math.PI / 2);
    const p = applyMatrix(m, vec2(1, 0));
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('multiplies matrices correctly', () => {
    const t = makeTranslation(10, 0);
    const s = makeScale(2, 2);
    const ts = multiplyMatrices(t, s);
    // First scale, then translate: (5,0) → scale → (10,0) → translate → (20,0)
    const p = applyMatrix(ts, vec2(5, 0));
    expect(p.x).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(0);
  });

  it('inverts translation matrix', () => {
    const m = makeTranslation(10, 20);
    const inv = invertMatrix(m);
    const p = applyMatrix(inv, vec2(15, 27));
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(7);
  });

  it('invert then apply is identity', () => {
    const m = multiplyMatrices(
      makeTranslation(10, 20),
      multiplyMatrices(makeRotation(0.5), makeScale(2, 3)),
    );
    const inv = invertMatrix(m);
    const combined = multiplyMatrices(m, inv);

    const p = applyMatrix(combined, vec2(42, 17));
    expect(p.x).toBeCloseTo(42);
    expect(p.y).toBeCloseTo(17);
  });

  it('decomposes translation', () => {
    const m = makeTranslation(10, 20);
    const d = decomposeMatrix(m);
    expect(d.translation).toEqual({ x: 10, y: 20 });
    expect(d.rotation).toBeCloseTo(0);
    expect(d.scale.x).toBeCloseTo(1);
    expect(d.scale.y).toBeCloseTo(1);
  });

  it('decomposes scale', () => {
    const m = makeScale(3, 5);
    const d = decomposeMatrix(m);
    expect(d.scale.x).toBeCloseTo(3);
    expect(d.scale.y).toBeCloseTo(5);
  });

  it('decomposes rotation', () => {
    const m = makeRotation(degToRad(45));
    const d = decomposeMatrix(m);
    expect(d.rotation).toBeCloseTo(45);
  });
});

describe('BoundingBox operations', () => {
  it('creates bounds from points', () => {
    const bb = boundsFromPoints([vec2(0, 0), vec2(10, 20), vec2(5, 5)]);
    expect(bb).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });

  it('creates empty bounds from no points', () => {
    const bb = boundsFromPoints([]);
    expect(bb).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('point in bounds', () => {
    const bb = { x: 0, y: 0, width: 10, height: 10 };
    expect(pointInBounds(vec2(5, 5), bb)).toBe(true);
    expect(pointInBounds(vec2(0, 0), bb)).toBe(true);
    expect(pointInBounds(vec2(10, 10), bb)).toBe(true);
    expect(pointInBounds(vec2(11, 5), bb)).toBe(false);
    expect(pointInBounds(vec2(-1, 5), bb)).toBe(false);
  });

  it('expands bounds', () => {
    const bb = expandBounds({ x: 5, y: 5, width: 10, height: 10 }, 2);
    expect(bb).toEqual({ x: 3, y: 3, width: 14, height: 14 });
  });

  it('detects intersecting bounds', () => {
    expect(
      boundsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 5, y: 5, width: 10, height: 10 },
      ),
    ).toBe(true);
  });

  it('detects non-intersecting bounds', () => {
    expect(
      boundsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 },
      ),
    ).toBe(false);
  });
});
