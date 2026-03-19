import { describe, it, expect } from 'vitest';
import { createDocument } from '@/document/types';
import {
  addNode,
  removeNode,
  updateNodeTransform,
  updateNodeStyle,
  getChildren,
  getAncestors,
  reparentNode,
} from '@/document/operations';

describe('Document operations', () => {
  it('creates a document', () => {
    const doc = createDocument('Test', 1920, 1080);
    expect(doc.name).toBe('Test');
    expect(doc.width).toBe(1920);
    expect(doc.height).toBe(1080);
    expect(Object.keys(doc.nodes)).toHaveLength(0);
    expect(doc.rootNodeIds).toHaveLength(0);
  });

  it('adds a node', () => {
    const doc = createDocument('Test');
    const { doc: newDoc, nodeId } = addNode(doc, 'rectangle');

    expect(nodeId).toBeTruthy();
    expect(newDoc.nodes[nodeId]).toBeDefined();
    expect(newDoc.nodes[nodeId]!.type).toBe('rectangle');
    expect(newDoc.rootNodeIds).toContain(nodeId);
  });

  it('removes a node', () => {
    const doc = createDocument('Test');
    const { doc: doc2, nodeId } = addNode(doc, 'rectangle');
    const doc3 = removeNode(doc2, nodeId);

    expect(doc3.nodes[nodeId]).toBeUndefined();
    expect(doc3.rootNodeIds).not.toContain(nodeId);
  });

  it('removes node and its descendants', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'group');
    doc = r1.doc;

    const r2 = addNode(doc, 'rectangle', { parentId: r1.nodeId });
    doc = r2.doc;

    const r3 = addNode(doc, 'ellipse', { parentId: r1.nodeId });
    doc = r3.doc;

    expect(Object.keys(doc.nodes)).toHaveLength(3);

    doc = removeNode(doc, r1.nodeId);
    expect(Object.keys(doc.nodes)).toHaveLength(0);
  });

  it('updates node transform', () => {
    const doc = createDocument('Test');
    const { doc: doc2, nodeId } = addNode(doc, 'rectangle');
    const doc3 = updateNodeTransform(doc2, nodeId, { x: 42, y: 99 });

    expect(doc3.nodes[nodeId]!.transform.x).toBe(42);
    expect(doc3.nodes[nodeId]!.transform.y).toBe(99);
  });

  it('updates node style', () => {
    const doc = createDocument('Test');
    const { doc: doc2, nodeId } = addNode(doc, 'rectangle');
    const doc3 = updateNodeStyle(doc2, nodeId, { opacity: 0.5 });

    expect(doc3.nodes[nodeId]!.style.opacity).toBe(0.5);
  });

  it('gets children sorted by order', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'rectangle');
    doc = r1.doc;
    const r2 = addNode(doc, 'ellipse');
    doc = r2.doc;
    const r3 = addNode(doc, 'rectangle');
    doc = r3.doc;

    const children = getChildren(doc, null);
    expect(children).toHaveLength(3);
    expect(children[0]!.id).toBe(r1.nodeId);
    expect(children[1]!.id).toBe(r2.nodeId);
    expect(children[2]!.id).toBe(r3.nodeId);
  });

  it('gets ancestors', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'group');
    doc = r1.doc;
    const r2 = addNode(doc, 'group', { parentId: r1.nodeId });
    doc = r2.doc;
    const r3 = addNode(doc, 'rectangle', { parentId: r2.nodeId });
    doc = r3.doc;

    const ancestors = getAncestors(doc, r3.nodeId);
    expect(ancestors).toEqual([r2.nodeId, r1.nodeId]);
  });

  it('reparents a node', () => {
    let doc = createDocument('Test');
    const r1 = addNode(doc, 'group');
    doc = r1.doc;
    const r2 = addNode(doc, 'rectangle');
    doc = r2.doc;

    expect(doc.rootNodeIds).toContain(r2.nodeId);

    doc = reparentNode(doc, r2.nodeId, r1.nodeId, 0);
    expect(doc.rootNodeIds).not.toContain(r2.nodeId);
    expect(doc.nodes[r2.nodeId]!.parentId).toBe(r1.nodeId);
  });
});
