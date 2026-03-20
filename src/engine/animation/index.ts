import type { AnimatableProperty, Document, Keyframe, SceneNode } from '@/document/types';

function evaluateTrack(track: Keyframe[] | undefined, time: number): number | undefined {
  if (!track || track.length === 0) return undefined;
  if (time <= track[0]!.time) return track[0]!.value;
  if (time >= track[track.length - 1]!.time) return track[track.length - 1]!.value;

  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i]!;
    const b = track[i + 1]!;
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return b.value;
      const t = (time - a.time) / span;
      return a.value + (b.value - a.value) * t;
    }
  }

  return track[track.length - 1]!.value;
}

export function evaluateNodeAtTime(node: SceneNode, time: number): SceneNode {
  const x = evaluateTrack(node.animation.tracks.x, time);
  const y = evaluateTrack(node.animation.tracks.y, time);
  const scaleX = evaluateTrack(node.animation.tracks.scaleX, time);
  const scaleY = evaluateTrack(node.animation.tracks.scaleY, time);
  const rotation = evaluateTrack(node.animation.tracks.rotation, time);
  const opacity = evaluateTrack(node.animation.tracks.opacity, time);

  return {
    ...node,
    transform: {
      ...node.transform,
      x: x ?? node.transform.x,
      y: y ?? node.transform.y,
      scaleX: scaleX ?? node.transform.scaleX,
      scaleY: scaleY ?? node.transform.scaleY,
      rotation: rotation ?? node.transform.rotation,
    },
    style: {
      ...node.style,
      opacity: opacity ?? node.style.opacity,
    },
  };
}

export function evaluateDocumentAtTime(doc: Document, time: number): Document {
  const nextNodes: Document['nodes'] = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    nextNodes[id] = evaluateNodeAtTime(node, time);
  }

  return {
    ...doc,
    nodes: nextNodes,
  };
}

export function hasKeyframeAtTime(node: SceneNode, property: AnimatableProperty, time: number): boolean {
  const track = node.animation.tracks[property] ?? [];
  return track.some((k) => Math.abs(k.time - time) < 1e-6);
}
