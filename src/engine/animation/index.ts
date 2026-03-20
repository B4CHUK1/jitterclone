import type {
  AnimatableProperty,
  Document,
  Keyframe,
  NodeAnimation,
  SceneNode,
} from '@/document/types';

export function getPropertyStaticValue(node: SceneNode, property: AnimatableProperty): number {
  switch (property) {
    case 'x':
      return node.transform.x;
    case 'y':
      return node.transform.y;
    case 'scaleX':
      return node.transform.scaleX;
    case 'scaleY':
      return node.transform.scaleY;
    case 'rotation':
      return node.transform.rotation;
    case 'opacity':
      return node.style.opacity;
  }
}

export function applyStaticValueToNode(
  node: SceneNode,
  property: AnimatableProperty,
  value: number,
): SceneNode {
  switch (property) {
    case 'x':
    case 'y':
    case 'scaleX':
    case 'scaleY':
    case 'rotation':
      return {
        ...node,
        transform: {
          ...node.transform,
          [property]: value,
        },
      };
    case 'opacity':
      return {
        ...node,
        style: {
          ...node.style,
          opacity: value,
        },
      };
  }
}

function evaluateTrack(track: Keyframe[], time: number): number | undefined {
  if (track.length === 0) return undefined;
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

function evaluateAnimatedProperty(node: SceneNode, property: AnimatableProperty, time: number): number {
  const propertyState = node.animation.properties[property];
  if (!propertyState.animated) return getPropertyStaticValue(node, property);
  const value = evaluateTrack(propertyState.keyframes, time);
  return value ?? getPropertyStaticValue(node, property);
}

export function evaluateNodeAtTime(node: SceneNode, time: number): SceneNode {
  return {
    ...node,
    transform: {
      ...node.transform,
      x: evaluateAnimatedProperty(node, 'x', time),
      y: evaluateAnimatedProperty(node, 'y', time),
      scaleX: evaluateAnimatedProperty(node, 'scaleX', time),
      scaleY: evaluateAnimatedProperty(node, 'scaleY', time),
      rotation: evaluateAnimatedProperty(node, 'rotation', time),
    },
    style: {
      ...node.style,
      opacity: evaluateAnimatedProperty(node, 'opacity', time),
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
  const track = node.animation.properties[property].keyframes;
  return track.some((k) => Math.abs(k.time - time) < 1e-6);
}

export function isPropertyAnimated(node: SceneNode, property: AnimatableProperty): boolean {
  return node.animation.properties[property].animated;
}

export function withPropertyAnimation(
  node: SceneNode,
  property: AnimatableProperty,
  updates: Partial<NodeAnimation['properties'][AnimatableProperty]>,
): SceneNode {
  return {
    ...node,
    animation: {
      properties: {
        ...node.animation.properties,
        [property]: {
          ...node.animation.properties[property],
          ...updates,
        },
      },
    },
  };
}
