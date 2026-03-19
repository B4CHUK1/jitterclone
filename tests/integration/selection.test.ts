import { describe, it, expect } from 'vitest';
import { createDocument } from '@/document/types';
import { addNode } from '@/document/operations';
import { defaultTransform } from '@/engine/transform/transform';
import { buildSceneGraph } from '@/engine/scene/sceneGraph';
import { hitTestPoint, hitTestRect } from '@/engine/interaction/hitTest';
import { vec2 } from '@/engine/transform/math';

describe('Selection integration', () => {
  function setupScene() {
    let doc = createDocument('Test');

    // Rectangle at (100, 100), 200x200
    const r1 = addNode(doc, 'rectangle', {
      transform: { ...defaultTransform(), x: 100, y: 100, width: 200, height: 200 },
    });
    doc = r1.doc;

    // Ellipse at (400, 100), 150x150
    const r2 = addNode(doc, 'ellipse', {
      transform: { ...defaultTransform(), x: 400, y: 100, width: 150, height: 150 },
    });
    doc = r2.doc;

    // Locked rectangle at (700, 100), 100x100
    const r3 = addNode(doc, 'rectangle', {
      transform: { ...defaultTransform(), x: 700, y: 100, width: 100, height: 100 },
      locked: true,
    });
    doc = r3.doc;

    return { doc, ids: { rect: r1.nodeId, ellipse: r2.nodeId, locked: r3.nodeId } };
  }

  it('hits the rectangle at its center', () => {
    const { doc } = setupScene();
    const scene = buildSceneGraph(doc);
    const hit = hitTestPoint(scene, vec2(200, 200));
    expect(hit).not.toBeNull();
    expect(hit!.node.type).toBe('rectangle');
  });

  it('hits the ellipse at its center', () => {
    const { doc } = setupScene();
    const scene = buildSceneGraph(doc);
    const hit = hitTestPoint(scene, vec2(475, 175));
    expect(hit).not.toBeNull();
    expect(hit!.node.type).toBe('ellipse');
  });

  it('misses when clicking empty space', () => {
    const { doc } = setupScene();
    const scene = buildSceneGraph(doc);
    const hit = hitTestPoint(scene, vec2(0, 0));
    expect(hit).toBeNull();
  });

  it('does not hit locked nodes', () => {
    const { doc } = setupScene();
    const scene = buildSceneGraph(doc);
    const hit = hitTestPoint(scene, vec2(750, 150));
    expect(hit).toBeNull();
  });

  it('marquee selects elements within rect', () => {
    const { doc, ids } = setupScene();
    const scene = buildSceneGraph(doc);

    // Big marquee that covers both rect and ellipse
    const hits = hitTestRect(scene, { x: 50, y: 50, width: 600, height: 300 });
    const hitIds = hits.map((h) => h.node.id);

    expect(hitIds).toContain(ids.rect);
    expect(hitIds).toContain(ids.ellipse);
    expect(hitIds).not.toContain(ids.locked); // locked is at 700, outside our rect (50+600=650)
  });

  it('marquee selects nothing when no elements in rect', () => {
    const { doc } = setupScene();
    const scene = buildSceneGraph(doc);

    const hits = hitTestRect(scene, { x: 900, y: 900, width: 100, height: 100 });
    expect(hits).toHaveLength(0);
  });

  it('hits topmost element when overlapping', () => {
    let doc = createDocument('Test');

    const r1 = addNode(doc, 'rectangle', {
      name: 'bottom',
      transform: { ...defaultTransform(), x: 0, y: 0, width: 200, height: 200 },
    });
    doc = r1.doc;

    const r2 = addNode(doc, 'rectangle', {
      name: 'top',
      transform: { ...defaultTransform(), x: 50, y: 50, width: 200, height: 200 },
    });
    doc = r2.doc;

    const scene = buildSceneGraph(doc);
    const hit = hitTestPoint(scene, vec2(100, 100)); // overlapping region
    expect(hit).not.toBeNull();
    expect(hit!.node.name).toBe('top'); // topmost wins
  });
});
