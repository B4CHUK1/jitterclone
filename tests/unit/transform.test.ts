import { describe, it, expect } from 'vitest';
import {
  defaultTransform,
  computeLocalMatrix,
  computeWorldMatrix,
  getWorldCorners,
  getWorldAnchor,
  worldToLocal,
  localToWorld,
  computeAllWorldMatrices,
} from '@/engine/transform/transform';
import { IDENTITY_MATRIX, applyMatrix, vec2 } from '@/engine/transform/math';

describe('Transform computations', () => {
  it('default transform has identity-like matrix', () => {
    const t = defaultTransform();
    const m = computeLocalMatrix(t);
    // Default: pos(0,0), rot(0), scale(1,1), anchor(0.5,0.5)
    // The matrix should map (50,50) to (50,50) (center stays)
    const center = applyMatrix(m, vec2(50, 50));
    expect(center.x).toBeCloseTo(50);
    expect(center.y).toBeCloseTo(50);
  });

  it('translation works', () => {
    const t = { ...defaultTransform(), x: 100, y: 200 };
    const m = computeLocalMatrix(t);
    const origin = applyMatrix(m, vec2(0, 0));
    expect(origin.x).toBeCloseTo(100);
    expect(origin.y).toBeCloseTo(200);
  });

  it('rotation rotates around anchor', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100, rotation: 90 };
    const m = computeLocalMatrix(t);

    // Top-left corner (0,0) should rotate 90° around center (50,50)
    const tl = applyMatrix(m, vec2(0, 0));
    expect(tl.x).toBeCloseTo(100);
    expect(tl.y).toBeCloseTo(0);
  });

  it('getWorldCorners returns 4 corners', () => {
    const t = { ...defaultTransform(), x: 10, y: 20, width: 100, height: 50 };
    const m = computeLocalMatrix(t);
    const corners = getWorldCorners(t, m);
    expect(corners).toHaveLength(4);

    // For no rotation, corners should be axis-aligned
    expect(corners[0].x).toBeCloseTo(10);
    expect(corners[0].y).toBeCloseTo(20);
    expect(corners[1].x).toBeCloseTo(110);
    expect(corners[1].y).toBeCloseTo(20);
    expect(corners[2].x).toBeCloseTo(110);
    expect(corners[2].y).toBeCloseTo(70);
    expect(corners[3].x).toBeCloseTo(10);
    expect(corners[3].y).toBeCloseTo(70);
  });

  it('getWorldAnchor returns correct anchor position', () => {
    const t = { ...defaultTransform(), x: 0, y: 0, width: 100, height: 100 };
    const m = computeLocalMatrix(t);
    const anchor = getWorldAnchor(t, m);
    expect(anchor.x).toBeCloseTo(50);
    expect(anchor.y).toBeCloseTo(50);
  });

  it('worldToLocal and localToWorld are inverse', () => {
    const t = { ...defaultTransform(), x: 50, y: 50, rotation: 30, width: 200, height: 100 };
    const m = computeLocalMatrix(t);

    const worldPt = vec2(150, 100);
    const local = worldToLocal(m, worldPt);
    const backToWorld = localToWorld(m, local);

    expect(backToWorld.x).toBeCloseTo(worldPt.x);
    expect(backToWorld.y).toBeCloseTo(worldPt.y);
  });

  it('computeWorldMatrix chains parent and local', () => {
    const parent = computeLocalMatrix({ ...defaultTransform(), x: 100, y: 100 });
    const child = computeLocalMatrix({ ...defaultTransform(), x: 50, y: 50 });
    const world = computeWorldMatrix(parent, child);

    const origin = applyMatrix(world, vec2(0, 0));
    expect(origin.x).toBeCloseTo(150);
    expect(origin.y).toBeCloseTo(150);
  });

  it('computeAllWorldMatrices handles nesting', () => {
    const nodes = [
      { id: 'a', parentId: null, transform: { ...defaultTransform(), x: 100, y: 0 } },
      { id: 'b', parentId: 'a', transform: { ...defaultTransform(), x: 50, y: 0 } },
      { id: 'c', parentId: 'b', transform: { ...defaultTransform(), x: 25, y: 0 } },
    ];

    const matrices = computeAllWorldMatrices(nodes);

    const aOrigin = applyMatrix(matrices.get('a')!, vec2(0, 0));
    expect(aOrigin.x).toBeCloseTo(100);

    const bOrigin = applyMatrix(matrices.get('b')!, vec2(0, 0));
    expect(bOrigin.x).toBeCloseTo(150);

    const cOrigin = applyMatrix(matrices.get('c')!, vec2(0, 0));
    expect(cOrigin.x).toBeCloseTo(175);
  });
});
