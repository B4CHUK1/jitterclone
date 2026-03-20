import { describe, it, expect } from 'vitest';
import { createDocument } from '@/document/types';
import type { PathPoint, SceneNode } from '@/document/types';
import { addNode } from '@/document/operations';

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
