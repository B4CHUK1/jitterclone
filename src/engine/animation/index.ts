import type {
  AnimatableProperty,
  CubicBezierEasing,
  Document,
  EasingPreset,
  Keyframe,
  NodeAnimation,
  SceneNode,
} from '@/document/types';
import { EASING_PRESETS } from '@/document/types';

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

// ── Cubic Bezier Evaluation ──
// Standard algorithm used by CSS transitions (same as WebKit/Blink)

function sampleCurveX(ax: number, bx: number, cx: number, t: number): number {
  return ((ax * t + bx) * t + cx) * t;
}

function sampleCurveY(ay: number, by: number, cy: number, t: number): number {
  return ((ay * t + by) * t + cy) * t;
}

function sampleCurveDerivativeX(ax: number, bx: number, cx: number, t: number): number {
  return (3.0 * ax * t + 2.0 * bx) * t + cx;
}

/**
 * Solve cubic-bezier for Y given X using Newton-Raphson + bisection fallback.
 */
function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const cx = 3.0 * x1;
  const bx = 3.0 * (x2 - x1) - cx;
  const ax = 1.0 - cx - bx;

  const cy = 3.0 * y1;
  const by = 3.0 * (y2 - y1) - cy;
  const ay = 1.0 - cy - by;

  // Newton-Raphson
  let t = x;
  for (let i = 0; i < 8; i++) {
    const xEst = sampleCurveX(ax, bx, cx, t) - x;
    if (Math.abs(xEst) < 1e-7) {
      return sampleCurveY(ay, by, cy, t);
    }
    const d = sampleCurveDerivativeX(ax, bx, cx, t);
    if (Math.abs(d) < 1e-7) break;
    t -= xEst / d;
  }

  // Bisection fallback
  let lo = 0;
  let hi = 1;
  t = x;
  for (let i = 0; i < 20; i++) {
    const xEst = sampleCurveX(ax, bx, cx, t);
    if (Math.abs(xEst - x) < 1e-7) break;
    if (x > xEst) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }

  return sampleCurveY(ay, by, cy, t);
}

/**
 * Apply easing to a linear 0-1 parameter.
 */
export function applyEasing(t: number, easing: EasingPreset, bezier?: CubicBezierEasing): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  if (easing === 'hold') return 0;

  if (easing === 'custom' && bezier) {
    return solveCubicBezier(bezier.x1, bezier.y1, bezier.x2, bezier.y2, t);
  }

  const preset = EASING_PRESETS[easing === 'custom' ? 'linear' : easing];
  if (!preset || easing === 'linear') return t;

  return solveCubicBezier(preset.x1, preset.y1, preset.x2, preset.y2, t);
}

/**
 * Evaluate a keyframe track at a given LOCAL time.
 * Keyframe times are always relative to the clip (local time).
 * Applies per-keyframe easing curves.
 */
function evaluateTrack(track: Keyframe[], localTime: number): number | undefined {
  if (track.length === 0) return undefined;
  if (localTime <= track[0]!.time) return track[0]!.value;
  if (localTime >= track[track.length - 1]!.time) return track[track.length - 1]!.value;

  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i]!;
    const b = track[i + 1]!;
    if (localTime >= a.time && localTime <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return b.value;
      const t = (localTime - a.time) / span;
      const easedT = applyEasing(t, a.easing ?? 'linear', a.bezier);
      return a.value + (b.value - a.value) * easedT;
    }
  }

  return track[track.length - 1]!.value;
}

/**
 * Convert global timeline time to local clip time.
 */
export function globalToLocalTime(globalTime: number, node: SceneNode): number {
  return globalTime - node.startTime;
}

/**
 * Convert local clip time to global timeline time.
 */
export function localToGlobalTime(localTime: number, node: SceneNode): number {
  return localTime + node.startTime;
}

/**
 * Check if a node is active (visible) at the given global time.
 */
export function isNodeActiveAtTime(node: SceneNode, globalTime: number): boolean {
  return globalTime >= node.startTime && globalTime <= node.endTime;
}

/**
 * Get the clip duration of a node.
 */
export function getClipDuration(node: SceneNode): number {
  return node.endTime - node.startTime;
}

function evaluateAnimatedProperty(node: SceneNode, property: AnimatableProperty, localTime: number): number {
  const propertyState = node.animation.properties[property];
  if (!propertyState.animated) return getPropertyStaticValue(node, property);
  const value = evaluateTrack(propertyState.keyframes, localTime);
  return value ?? getPropertyStaticValue(node, property);
}

/**
 * Evaluate a node at a given GLOBAL time.
 * Converts to local time internally. If the node is outside its clip range,
 * it holds the first/last keyframe value (or static value).
 */
export function evaluateNodeAtTime(node: SceneNode, globalTime: number): SceneNode {
  const localTime = globalToLocalTime(globalTime, node);

  return {
    ...node,
    transform: {
      ...node.transform,
      x: evaluateAnimatedProperty(node, 'x', localTime),
      y: evaluateAnimatedProperty(node, 'y', localTime),
      scaleX: evaluateAnimatedProperty(node, 'scaleX', localTime),
      scaleY: evaluateAnimatedProperty(node, 'scaleY', localTime),
      rotation: evaluateAnimatedProperty(node, 'rotation', localTime),
    },
    style: {
      ...node.style,
      opacity: evaluateAnimatedProperty(node, 'opacity', localTime),
    },
  };
}

/**
 * Evaluate the entire document at a given global time.
 * Only includes nodes that are active at the given time.
 */
export function evaluateDocumentAtTime(doc: Document, globalTime: number): Document {
  const nextNodes: Document['nodes'] = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    if (!isNodeActiveAtTime(node, globalTime)) continue;
    nextNodes[id] = evaluateNodeAtTime(node, globalTime);
  }

  return {
    ...doc,
    nodes: nextNodes,
  };
}

export function hasKeyframeAtTime(node: SceneNode, property: AnimatableProperty, localTime: number): boolean {
  const track = node.animation.properties[property].keyframes;
  return track.some((k) => Math.abs(k.time - localTime) < 1e-6);
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

/**
 * Clamp a local keyframe time to stay within clip bounds [0, duration].
 */
export function clampKeyframeTime(localTime: number, node: SceneNode): number {
  const clipDuration = getClipDuration(node);
  return Math.max(0, Math.min(clipDuration, localTime));
}
