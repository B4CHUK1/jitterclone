import { describe, it, expect, beforeEach } from 'vitest';
import { createDocument } from '@/document/types';
import type { Document, SceneNode } from '@/document/types';
import { addNode, setNodeKeyframe, removeNodeKeyframe, setNodePropertyAnimation } from '@/document/operations';
import { clampKeyframeTime } from '@/engine/animation';

/**
 * Tests for multi-keyframe drag (batch moveKeyframes logic).
 * The batch move operation removes all source keyframes first, then inserts at new positions.
 * This prevents collisions when keyframes cross paths during grouped drag.
 */

function setupDocWithKeyframes(): { doc: Document; nodeId: string } {
  let doc = createDocument('Test');
  const result = addNode(doc, 'rectangle');
  doc = result.doc;
  const nodeId = result.nodeId;

  // Enable animation on x property
  doc = setNodePropertyAnimation(doc, nodeId, 'x', { animated: true, keyframes: [] });
  // Add three keyframes at times 0, 1, 2
  doc = setNodeKeyframe(doc, nodeId, 'x', { time: 0, value: 0, easing: 'linear' });
  doc = setNodeKeyframe(doc, nodeId, 'x', { time: 1, value: 100, easing: 'ease-in' });
  doc = setNodeKeyframe(doc, nodeId, 'x', { time: 2, value: 200, easing: 'ease-out' });

  return { doc, nodeId };
}

/**
 * Simulates the batch moveKeyframes operation:
 * Phase 1: Remove all keyframes from source positions
 * Phase 2: Insert all keyframes at new positions
 */
function batchMoveKeyframes(
  doc: Document,
  moves: Array<{ nodeId: string; property: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity'; fromLocalTime: number; toLocalTime: number }>,
): Document {
  // Phase 1: collect data and remove
  const collected: Array<{
    nodeId: string;
    property: string;
    toLocalTime: number;
    value: number;
    easing: string;
  }> = [];

  for (const move of moves) {
    const node = doc.nodes[move.nodeId];
    if (!node) continue;
    const keyframe = node.animation.properties[move.property].keyframes.find(
      (key) => Math.abs(key.time - move.fromLocalTime) < 1e-6,
    );
    if (!keyframe) continue;
    collected.push({
      nodeId: move.nodeId,
      property: move.property,
      toLocalTime: clampKeyframeTime(move.toLocalTime, node),
      value: keyframe.value,
      easing: keyframe.easing ?? 'linear',
    });
    doc = removeNodeKeyframe(doc, move.nodeId, move.property as any, move.fromLocalTime);
  }

  // Phase 2: insert at new positions
  for (const item of collected) {
    doc = setNodeKeyframe(doc, item.nodeId, item.property as any, {
      time: item.toLocalTime,
      value: item.value,
      easing: item.easing as any,
    });
  }

  return doc;
}

describe('Multi-keyframe drag', () => {
  it('moves multiple keyframes on the same property without collisions', () => {
    const { doc, nodeId } = setupDocWithKeyframes();

    // Move keyframes at t=1 and t=2 by +0.5s each
    const result = batchMoveKeyframes(doc, [
      { nodeId, property: 'x', fromLocalTime: 1, toLocalTime: 1.5 },
      { nodeId, property: 'x', fromLocalTime: 2, toLocalTime: 2.5 },
    ]);

    const keyframes = result.nodes[nodeId]!.animation.properties.x.keyframes;
    expect(keyframes).toHaveLength(3); // All three keyframes preserved
    expect(keyframes[0]!.time).toBeCloseTo(0);
    expect(keyframes[1]!.time).toBeCloseTo(1.5);
    expect(keyframes[2]!.time).toBeCloseTo(2.5);
  });

  it('preserves keyframe values and easing during batch move', () => {
    const { doc, nodeId } = setupDocWithKeyframes();

    const result = batchMoveKeyframes(doc, [
      { nodeId, property: 'x', fromLocalTime: 1, toLocalTime: 1.5 },
      { nodeId, property: 'x', fromLocalTime: 2, toLocalTime: 2.5 },
    ]);

    const keyframes = result.nodes[nodeId]!.animation.properties.x.keyframes;
    expect(keyframes[1]!.value).toBe(100);
    expect(keyframes[1]!.easing).toBe('ease-in');
    expect(keyframes[2]!.value).toBe(200);
    expect(keyframes[2]!.easing).toBe('ease-out');
  });

  it('handles keyframes crossing paths (swap positions)', () => {
    const { doc, nodeId } = setupDocWithKeyframes();

    // Swap keyframes at t=1 and t=2
    const result = batchMoveKeyframes(doc, [
      { nodeId, property: 'x', fromLocalTime: 1, toLocalTime: 2 },
      { nodeId, property: 'x', fromLocalTime: 2, toLocalTime: 1 },
    ]);

    const keyframes = result.nodes[nodeId]!.animation.properties.x.keyframes;
    expect(keyframes).toHaveLength(3);
    // After swap, t=1 should have value 200 (was at t=2), t=2 should have value 100 (was at t=1)
    const kf1 = keyframes.find((k) => Math.abs(k.time - 1) < 1e-6);
    const kf2 = keyframes.find((k) => Math.abs(k.time - 2) < 1e-6);
    expect(kf1!.value).toBe(200);
    expect(kf2!.value).toBe(100);
  });

  it('does not lose keyframes when moving multiple on same property', () => {
    const { doc, nodeId } = setupDocWithKeyframes();

    // Move all three keyframes by +0.3s
    const result = batchMoveKeyframes(doc, [
      { nodeId, property: 'x', fromLocalTime: 0, toLocalTime: 0.3 },
      { nodeId, property: 'x', fromLocalTime: 1, toLocalTime: 1.3 },
      { nodeId, property: 'x', fromLocalTime: 2, toLocalTime: 2.3 },
    ]);

    const keyframes = result.nodes[nodeId]!.animation.properties.x.keyframes;
    expect(keyframes).toHaveLength(3); // No keyframes lost
    expect(keyframes[0]!.time).toBeCloseTo(0.3);
    expect(keyframes[1]!.time).toBeCloseTo(1.3);
    expect(keyframes[2]!.time).toBeCloseTo(2.3);
  });

  it('clamps keyframe time to clip duration', () => {
    const { doc, nodeId } = setupDocWithKeyframes();
    const node = doc.nodes[nodeId]!;
    const clipDuration = node.endTime - node.startTime;

    // Try to move beyond clip duration
    const result = batchMoveKeyframes(doc, [
      { nodeId, property: 'x', fromLocalTime: 2, toLocalTime: clipDuration + 10 },
    ]);

    const keyframes = result.nodes[nodeId]!.animation.properties.x.keyframes;
    const movedKf = keyframes.find((k) => k.value === 200);
    expect(movedKf!.time).toBeLessThanOrEqual(clipDuration);
  });
});
