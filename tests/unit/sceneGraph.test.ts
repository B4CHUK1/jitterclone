import { describe, it, expect } from 'vitest';
import { createDocument } from '@/document/types';
import { addNode } from '@/document/operations';
import {
  buildSceneGraph,
  flattenSceneGraph,
  findRenderNode,
  getWorldMatrixMap,
} from '@/engine/scene/sceneGraph';

describe('Scene graph', () => {
  it('builds from empty document', () => {
    const doc = createDocument('Test');
    const roots = buildSceneGraph(doc);
    expect(roots).toHaveLength(0);
  });

  it('builds root nodes', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'rectangle');
    doc = r1.doc;
    const r2 = addNode(doc, 'ellipse');
    doc = r2.doc;

    const roots = buildSceneGraph(doc);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.node.id).toBe(r1.nodeId);
    expect(roots[1]!.node.id).toBe(r2.nodeId);
  });

  it('builds nested nodes', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'group');
    doc = r1.doc;
    const r2 = addNode(doc, 'rectangle', { parentId: r1.nodeId });
    doc = r2.doc;

    const roots = buildSceneGraph(doc);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.children).toHaveLength(1);
    expect(roots[0]!.children[0]!.node.id).toBe(r2.nodeId);
  });

  it('flattens scene graph', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'group');
    doc = r1.doc;
    const r2 = addNode(doc, 'rectangle', { parentId: r1.nodeId });
    doc = r2.doc;
    const r3 = addNode(doc, 'ellipse');
    doc = r3.doc;

    const roots = buildSceneGraph(doc);
    const flat = flattenSceneGraph(roots);
    expect(flat).toHaveLength(3);
  });

  it('finds render node by id', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'group');
    doc = r1.doc;
    const r2 = addNode(doc, 'rectangle', { parentId: r1.nodeId });
    doc = r2.doc;

    const roots = buildSceneGraph(doc);
    const found = findRenderNode(roots, r2.nodeId);
    expect(found).not.toBeNull();
    expect(found!.node.id).toBe(r2.nodeId);
  });

  it('returns null for missing node', () => {
    const doc = createDocument('Test');
    const roots = buildSceneGraph(doc);
    expect(findRenderNode(roots, 'nonexistent')).toBeNull();
  });

  it('builds world matrix map', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'rectangle');
    doc = r1.doc;

    const roots = buildSceneGraph(doc);
    const map = getWorldMatrixMap(roots);
    expect(map.has(r1.nodeId)).toBe(true);
  });
});
