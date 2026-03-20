import { describe, it, expect } from 'vitest';
import { createDocument } from '@/document/types';
import type { PathPoint, SceneNode } from '@/document/types';
import { addNode } from '@/document/operations';

import { computePenPathBounds, normalizePenPath, type PenPoint } from '@/ui/components/penPathUtils';
import { getBlurFilterArea, getNodeBlurFilterConfig } from '@/engine/renderer/pixiRenderer';

function denormalizePoint(point: { x: number; y: number }, transform: { x: number; y: number; width: number; height: number }) {
  const minX = transform.x - transform.width / 2;
  const minY = transform.y - transform.height / 2;
  return {
    x: minX + point.x * transform.width,
    y: minY + point.y * transform.height,
  };
}

function sampleCubicPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
) {
  const mt = 1 - t;
  return {
    x: (mt ** 3) * p0.x + 3 * (mt ** 2) * t * p1.x + 3 * mt * (t ** 2) * p2.x + (t ** 3) * p3.x,
    y: (mt ** 3) * p0.y + 3 * (mt ** 2) * t * p1.y + 3 * mt * (t ** 2) * p2.y + (t ** 3) * p3.y,
  };
}

describe('Path closure and fill', () => {
  it('creates a path node with pathClosed flag', () => {
    const doc = createDocument('Test');
    const pathData: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const { doc: newDoc, nodeId } = addNode(doc, 'path', {
      pathData,
      pathClosed: true,
    } as Partial<SceneNode>);

    const node = newDoc.nodes[nodeId]!;
    expect(node.type).toBe('path');
    expect(node.pathData).toEqual(pathData);
    expect(node.pathClosed).toBe(true);
  });

  it('creates an open path by default', () => {
    const doc = createDocument('Test');
    const pathData: PathPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0.5 },
    ];
    const { doc: newDoc, nodeId } = addNode(doc, 'path', {
      pathData,
    } as Partial<SceneNode>);

    const node = newDoc.nodes[nodeId]!;
    expect(node.pathClosed).toBeUndefined();
  });

  it('stores Bézier handle data on path points', () => {
    const doc = createDocument('Test');
    const pathData: PathPoint[] = [
      { x: 0, y: 0.5, handleOutX: 0.1, handleOutY: -0.2 },
      { x: 0.5, y: 0, handleInX: -0.1, handleInY: 0.2, handleOutX: 0.1, handleOutY: 0.2 },
      { x: 1, y: 0.5, handleInX: -0.1, handleInY: -0.2 },
    ];
    const { doc: newDoc, nodeId } = addNode(doc, 'path', {
      pathData,
      pathClosed: true,
    } as Partial<SceneNode>);

    const node = newDoc.nodes[nodeId]!;
    expect(node.pathData![0]!.handleOutX).toBe(0.1);
    expect(node.pathData![0]!.handleOutY).toBe(-0.2);
    expect(node.pathData![1]!.handleInX).toBe(-0.1);
    expect(node.pathData![1]!.handleOutX).toBe(0.1);
  });

  it('closed path fill should have opacity 1 on a closed shape', () => {
    const doc = createDocument('Test');
    const { doc: newDoc, nodeId } = addNode(doc, 'path', {
      pathData: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 1 },
      ],
      pathClosed: true,
      style: {
        fill: { color: '#ff0000', opacity: 1 },
        stroke: null,
        opacity: 1,
        cornerRadius: 0,
        effects: [],
        blendMode: 'normal' as const,
      },
    } as Partial<SceneNode>);

    const node = newDoc.nodes[nodeId]!;
    expect(node.style.fill.opacity).toBe(1);
    expect(node.pathClosed).toBe(true);
  });
});

describe('Blur effect on shapes', () => {
  it('stores blur effect on a node', () => {
    const doc = createDocument('Test');
    const { doc: newDoc, nodeId } = addNode(doc, 'ellipse', {
      style: {
        fill: { color: '#5B8DEF', opacity: 1 },
        stroke: null,
        opacity: 1,
        cornerRadius: 0,
        effects: [{ type: 'blur', radius: 10 }],
        blendMode: 'normal' as const,
      },
    } as Partial<SceneNode>);

    const node = newDoc.nodes[nodeId]!;
    expect(node.style.effects).toHaveLength(1);
    expect(node.style.effects[0]!.type).toBe('blur');
    expect((node.style.effects[0] as { type: 'blur'; radius: number }).radius).toBe(10);
  });

  it('blur and fill coexist on same node', () => {
    const doc = createDocument('Test');
    const { doc: newDoc, nodeId } = addNode(doc, 'star', {
      style: {
        fill: { color: '#ff0000', opacity: 0.8 },
        stroke: { color: '#00ff00', width: 2, opacity: 1 },
        opacity: 0.9,
        cornerRadius: 0,
        effects: [{ type: 'blur', radius: 5 }],
        blendMode: 'normal' as const,
      },
    } as Partial<SceneNode>);

    const node = newDoc.nodes[nodeId]!;
    expect(node.style.fill.opacity).toBe(0.8);
    expect(node.style.effects[0]!.type).toBe('blur');
    expect(node.style.opacity).toBe(0.9);
  });
});


describe('Pen path normalization', () => {
  it('captures cubic extrema for bounds instead of anchor-only bounds', () => {
    const points: PenPoint[] = [
      { x: 100, y: 200, handleInX: 0, handleInY: 0, handleOutX: 120, handleOutY: -260 },
      { x: 300, y: 220, handleInX: -140, handleInY: 280, handleOutX: 0, handleOutY: 0 },
    ];

    const bounds = computePenPathBounds(points, false);
    expect(bounds.minY).toBeLessThan(200);
    expect(bounds.maxY).toBeGreaterThan(220);
  });

  it('matches sampled cubic bounds and does not introduce transform translation drift', () => {
    const points: PenPoint[] = [
      { x: 220, y: 170, handleInX: 0, handleInY: 0, handleOutX: 240, handleOutY: -210 },
      { x: 520, y: 260, handleInX: -280, handleInY: 340, handleOutX: 0, handleOutY: 0 },
    ];
    const bounds = computePenPathBounds(points, false);

    let sampledMinX = Infinity;
    let sampledMinY = Infinity;
    let sampledMaxX = -Infinity;
    let sampledMaxY = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;
      const pt = sampleCubicPoint(
        { x: points[0]!.x, y: points[0]!.y },
        { x: points[0]!.x + points[0]!.handleOutX, y: points[0]!.y + points[0]!.handleOutY },
        { x: points[1]!.x + points[1]!.handleInX, y: points[1]!.y + points[1]!.handleInY },
        { x: points[1]!.x, y: points[1]!.y },
        t,
      );
      sampledMinX = Math.min(sampledMinX, pt.x);
      sampledMinY = Math.min(sampledMinY, pt.y);
      sampledMaxX = Math.max(sampledMaxX, pt.x);
      sampledMaxY = Math.max(sampledMaxY, pt.y);
    }

    expect(bounds.minX).toBeCloseTo(sampledMinX, 0);
    expect(bounds.maxX).toBeCloseTo(sampledMaxX, 0);
    expect(bounds.minY).toBeCloseTo(sampledMinY, 0);
    expect(bounds.maxY).toBeCloseTo(sampledMaxY, 0);

    const normalized = normalizePenPath(points, false);
    const restored = normalized.pathData.map((point) => denormalizePoint(point, normalized.transform));
    expect(restored[0]!.x).toBeCloseTo(points[0]!.x, 6);
    expect(restored[0]!.y).toBeCloseTo(points[0]!.y, 6);
    expect(restored[1]!.x).toBeCloseTo(points[1]!.x, 6);
    expect(restored[1]!.y).toBeCloseTo(points[1]!.y, 6);
  });

  it('preview points and persisted path points stay in the same world-space positions', () => {
    const points: PenPoint[] = [
      { x: 120, y: 80, handleInX: 0, handleInY: 0, handleOutX: 80, handleOutY: -30 },
      { x: 300, y: 190, handleInX: -70, handleInY: 40, handleOutX: 30, handleOutY: 50 },
      { x: 260, y: 320, handleInX: -20, handleInY: -80, handleOutX: 0, handleOutY: 0 },
    ];

    const normalized = normalizePenPath(points, true);

    const restored = normalized.pathData.map((point) => denormalizePoint(point, normalized.transform));
    restored.forEach((point, index) => {
      expect(point.x).toBeCloseTo(points[index]!.x, 6);
      expect(point.y).toBeCloseTo(points[index]!.y, 6);
    });
  });

  it('keeps finalize transform anchored to placed points even when handles overshoot', () => {
    const points: PenPoint[] = [
      { x: 200, y: 200, handleInX: 0, handleInY: 0, handleOutX: 260, handleOutY: -220 },
      { x: 360, y: 240, handleInX: -250, handleInY: 280, handleOutX: 0, handleOutY: 0 },
      { x: 420, y: 300, handleInX: 0, handleInY: 0, handleOutX: 0, handleOutY: 0 },
    ];
    const normalized = normalizePenPath(points, true);
    expect(normalized.transform.x).toBe(310);
    expect(normalized.transform.y).toBe(250);
    expect(normalized.transform.width).toBe(220);
    expect(normalized.transform.height).toBe(100);
  });
});


describe('Blur filter pipeline', () => {
  it('creates a blur filter that keeps edge-repeat disabled', () => {
    const config = getNodeBlurFilterConfig(12, 3);
    expect(config.repeatEdgePixels).toBe(false);
    expect(config.padding).toBe(Math.ceil(12 * 2 + 3));
  });

  it('builds a blur filter area from shape bounds plus effect padding', () => {
    const area = getBlurFilterArea({ x: 100, y: 200, width: 80, height: 40 }, 12);
    expect(area.x).toBe(88);
    expect(area.y).toBe(188);
    expect(area.width).toBe(104);
    expect(area.height).toBe(64);
  });
});
