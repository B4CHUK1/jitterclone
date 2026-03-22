/**
 * Document store — the source of truth for the scene graph.
 * Holds the serializable document and exposes mutation actions.
 *
 * KEYFRAME CONVENTION:
 * All keyframe times are LOCAL to the clip (relative to node.startTime).
 * When the user interacts at a global time, we convert:
 *   localTime = globalTime - node.startTime
 */

import { create } from 'zustand';
import type {
  AnimatableProperty,
  CubicBezierEasing,
  Document,
  EasingPreset,
  Effect,
  NodeType,
  NodeStyle,
  PathPoint,
  SceneNode,
} from '@/document/types';
import { createDocument } from '@/document/types';
import {
  addNode,
  removeNode,
  updateNodeTransform,
  updateManyNodeTransforms,
  updateNodeStyle,
  updateNodeProps,
  updateComposition,
  setNodeKeyframe,
  removeNodeKeyframe,
  setNodePropertyAnimation,
  updateNodeTiming,
  reorderRootNodes,
  updateNodePathData,
  convertNodeToPath,
} from '@/document/operations';
import type { Transform } from '@/engine/transform';
import {
  applyStaticValueToNode,
  evaluateNodeAtTime,
  getPropertyStaticValue,
  globalToLocalTime,
  clampKeyframeTime,
} from '@/engine/animation';
import type { AnimationPreset } from '@/engine/animation/presets';
import { getPresetKeyframes } from '@/engine/animation/presets';

interface DocumentState {
  document: Document;

  // Actions
  addNode: (type: NodeType, overrides?: Partial<SceneNode>) => string;
  removeNode: (nodeId: string) => void;
  updateTransform: (nodeId: string, updates: Partial<Transform>) => void;
  updateTransforms: (updates: Map<string, Partial<Transform>>) => void;
  updateStyle: (nodeId: string, updates: Partial<NodeStyle>) => void;
  updateProps: (nodeId: string, updates: Partial<Pick<SceneNode, 'name' | 'visible' | 'locked'>>) => void;
  updateComposition: (
    updates: Partial<Pick<Document['composition'], 'name' | 'width' | 'height' | 'background' | 'duration' | 'fps' | 'workAreaStart' | 'workAreaEnd'>>,
  ) => void;

  /** Set a keyframe at LOCAL time */
  setKeyframe: (nodeId: string, property: AnimatableProperty, localTime: number, value: number) => void;
  /** Remove a keyframe at LOCAL time */
  removeKeyframe: (nodeId: string, property: AnimatableProperty, localTime: number) => void;
  /** Move a keyframe from one LOCAL time to another LOCAL time */
  moveKeyframe: (
    nodeId: string,
    property: AnimatableProperty,
    fromLocalTime: number,
    toLocalTime: number,
  ) => void;
  /** Batch-move multiple keyframes atomically (prevents collisions during multi-drag) */
  moveKeyframes: (
    moves: Array<{
      nodeId: string;
      property: AnimatableProperty;
      fromLocalTime: number;
      toLocalTime: number;
    }>,
  ) => void;
  /**
   * Set an animatable value. If the property is animated, inserts a keyframe
   * at the given GLOBAL time (converted to local internally).
   */
  setAnimatableValue: (
    nodeId: string,
    property: AnimatableProperty,
    value: number,
    globalTime: number,
    autoKeyframe: boolean,
  ) => void;
  togglePropertyStopwatch: (nodeId: string, property: AnimatableProperty, globalTime: number) => void;
  /** Add a keyframe at the current GLOBAL time */
  addKeyframeAtCurrentTime: (nodeId: string, property: AnimatableProperty, globalTime: number) => void;

  /** Set easing on a keyframe */
  setKeyframeEasing: (nodeId: string, property: AnimatableProperty, localTime: number, easing: EasingPreset, bezier?: CubicBezierEasing) => void;
  /** Apply animation preset */
  applyPreset: (nodeId: string, preset: AnimationPreset, globalTime: number) => void;
  /** Add an effect to a node */
  addEffect: (nodeId: string, effect: Effect) => void;
  /** Update an effect at index */
  updateEffect: (nodeId: string, index: number, effect: Effect) => void;
  /** Remove an effect by index */
  removeEffect: (nodeId: string, index: number) => void;

  /** Update clip timing (startTime/endTime) */
  updateTiming: (nodeId: string, updates: { startTime?: number; endTime?: number }) => void;

  /** Reorder root layer ids */
  reorderLayers: (orderedIds: string[]) => void;

  /** Update path data for a path node (no undo — used during live editing) */
  updatePathData: (nodeId: string, pathData: PathPoint[], pathClosed: boolean) => void;
  /** Convert a geometric shape to a path node (with undo) */
  convertToPath: (nodeId: string) => void;

  /** Undo/Redo */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  getNode: (nodeId: string) => SceneNode | undefined;
  reset: (doc?: Document) => void;
}

function getEvaluatedAnimatableValue(
  node: SceneNode,
  property: AnimatableProperty,
  globalTime: number,
): number {
  const evaluated = evaluateNodeAtTime(node, globalTime);
  if (property === 'opacity') return evaluated.style.opacity;
  return evaluated.transform[property as keyof Transform] as number;
}

// ── Undo/Redo History ──
const MAX_UNDO = 100;
const undoStack: Document[] = [];
const redoStack: Document[] = [];

function pushUndo(doc: Document) {
  undoStack.push(doc);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0; // clear redo on new action
}

/** Wrapper that records undo before mutating */
function withUndo(set: (s: Partial<DocumentState>) => void, get: () => DocumentState, nextDoc: Document) {
  pushUndo(get().document);
  set({ document: nextDoc, canUndo: true, canRedo: false });
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: createDocument('Untitled', 1920, 1080),
  canUndo: false,
  canRedo: false,

  addNode: (type, overrides) => {
    const result = addNode(get().document, type, overrides);
    withUndo(set, get, result.doc);
    return result.nodeId;
  },

  removeNode: (nodeId) => {
    withUndo(set, get, removeNode(get().document, nodeId));
  },

  updateTransform: (nodeId, updates) => {
    // No undo for continuous transforms (drag) to avoid flooding history
    set({ document: updateNodeTransform(get().document, nodeId, updates) });
  },

  updateTransforms: (updates) => {
    set({ document: updateManyNodeTransforms(get().document, updates) });
  },

  updateStyle: (nodeId, updates) => {
    withUndo(set, get, updateNodeStyle(get().document, nodeId, updates));
  },

  updateProps: (nodeId, updates) => {
    withUndo(set, get, updateNodeProps(get().document, nodeId, updates));
  },

  updateComposition: (updates) => {
    withUndo(set, get, updateComposition(get().document, updates));
  },

  setKeyframe: (nodeId, property, localTime, value) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const clamped = clampKeyframeTime(localTime, node);
    withUndo(set, get, setNodeKeyframe(doc, nodeId, property, { time: clamped, value, easing: 'linear' as const }));
  },

  removeKeyframe: (nodeId, property, localTime) => {
    withUndo(set, get, removeNodeKeyframe(get().document, nodeId, property, localTime));
  },

  moveKeyframe: (nodeId, property, fromLocalTime, toLocalTime) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const keyframe = node.animation.properties[property].keyframes.find(
      (key) => Math.abs(key.time - fromLocalTime) < 1e-6,
    );
    if (!keyframe) return;
    const clamped = clampKeyframeTime(toLocalTime, node);
    let nextDoc = removeNodeKeyframe(doc, nodeId, property, fromLocalTime);
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: clamped, value: keyframe.value, easing: keyframe.easing ?? 'linear', bezier: keyframe.bezier });
    set({ document: nextDoc });
  },

  /**
   * Batch-move multiple keyframes atomically.
   * Removes all source keyframes first, then inserts at new times.
   * This prevents intermediate collisions when keyframes cross paths.
   */
  moveKeyframes: (moves) => {
    let doc = get().document;
    // Phase 1: collect all keyframe data and remove from source positions
    const collected: Array<{
      nodeId: string;
      property: AnimatableProperty;
      toLocalTime: number;
      value: number;
      easing: import('@/document/types').EasingPreset;
      bezier?: import('@/document/types').CubicBezierEasing;
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
        bezier: keyframe.bezier,
      });
      doc = removeNodeKeyframe(doc, move.nodeId, move.property, move.fromLocalTime);
    }
    // Phase 2: insert all keyframes at new positions
    for (const item of collected) {
      doc = setNodeKeyframe(doc, item.nodeId, item.property, {
        time: item.toLocalTime,
        value: item.value,
        easing: item.easing,
        bezier: item.bezier,
      });
    }
    set({ document: doc });
  },

  setAnimatableValue: (nodeId, property, value, globalTime, _autoKeyframe) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const propertyState = node.animation.properties[property];

    // Always update the static value
    let nextDoc: Document = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [nodeId]: applyStaticValueToNode(node, property, value),
      },
    };

    // If the property is animated, always insert/update keyframe at this time
    // (autoKeyframe only controls whether non-animated properties start animating)
    if (propertyState.animated) {
      const localTime = clampKeyframeTime(globalToLocalTime(globalTime, node), node);
      nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: localTime, value, easing: 'linear' as const });
    }

    set({ document: nextDoc });
  },

  togglePropertyStopwatch: (nodeId, property, globalTime) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const propertyState = node.animation.properties[property];

    if (!propertyState.animated) {
      // Enable animation: create first keyframe at current local time
      const value = getEvaluatedAnimatableValue(node, property, globalTime);
      const localTime = clampKeyframeTime(globalToLocalTime(globalTime, node), node);
      let nextDoc = setNodePropertyAnimation(doc, nodeId, property, {
        animated: true,
        keyframes: [],
      });
      nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: localTime, value, easing: 'linear' as const });
      set({ document: nextDoc });
      return;
    }

    // Disable animation: bake current value to static
    const value = getEvaluatedAnimatableValue(node, property, globalTime);
    let nextDoc: Document = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [nodeId]: applyStaticValueToNode(node, property, value),
      },
    };
    nextDoc = setNodePropertyAnimation(nextDoc, nodeId, property, {
      animated: false,
      keyframes: [],
    });
    set({ document: nextDoc });
  },

  addKeyframeAtCurrentTime: (nodeId, property, globalTime) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const value = getEvaluatedAnimatableValue(node, property, globalTime);
    const localTime = clampKeyframeTime(globalToLocalTime(globalTime, node), node);
    let nextDoc = doc;
    if (!node.animation.properties[property].animated) {
      nextDoc = setNodePropertyAnimation(nextDoc, nodeId, property, { animated: true, keyframes: [] });
    }
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: localTime, value, easing: 'linear' as const });
    set({ document: nextDoc });
  },

  setKeyframeEasing: (nodeId, property, localTime, easing, bezier) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const track = node.animation.properties[property].keyframes;
    const keyframe = track.find((k) => Math.abs(k.time - localTime) < 1e-6);
    if (!keyframe) return;
    // Remove old keyframe and re-insert with new easing
    let nextDoc = removeNodeKeyframe(doc, nodeId, property, localTime);
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, {
      time: keyframe.time,
      value: keyframe.value,
      easing,
      bezier,
    });
    withUndo(set, get, nextDoc);
  },

  applyPreset: (nodeId, preset, globalTime) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const localTime = globalToLocalTime(globalTime, node);

    // Get current static values for relative offset
    const currentValues: Record<string, number> = {};
    for (const prop of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'] as const) {
      currentValues[prop] = getPropertyStaticValue(node, prop);
    }

    const tracks = getPresetKeyframes(preset, localTime, currentValues as Record<import('@/document/types').AnimatableProperty, number>);

    let nextDoc = doc;
    for (const track of tracks) {
      // Enable animation on the property
      nextDoc = setNodePropertyAnimation(nextDoc, nodeId, track.property, {
        animated: true,
        keyframes: [],
      });
      // Add all keyframes
      for (const kf of track.keyframes) {
        nextDoc = setNodeKeyframe(nextDoc, nodeId, track.property, kf);
      }
    }
    withUndo(set, get, nextDoc);
  },

  addEffect: (nodeId, effect) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    withUndo(set, get, updateNodeStyle(doc, nodeId, {
      effects: [...node.style.effects, effect],
    }));
  },

  updateEffect: (nodeId, index, effect) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const effects = node.style.effects.map((e, i) => (i === index ? effect : e));
    set({ document: updateNodeStyle(doc, nodeId, { effects }) });
  },

  removeEffect: (nodeId, index) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const effects = node.style.effects.filter((_, i) => i !== index);
    withUndo(set, get, updateNodeStyle(doc, nodeId, { effects }));
  },

  updateTiming: (nodeId, updates) => {
    set({ document: updateNodeTiming(get().document, nodeId, updates) });
  },

  reorderLayers: (orderedIds) => {
    withUndo(set, get, reorderRootNodes(get().document, orderedIds));
  },

  updatePathData: (nodeId, pathData, pathClosed) => {
    set({ document: updateNodePathData(get().document, nodeId, pathData, pathClosed) });
  },

  convertToPath: (nodeId) => {
    withUndo(set, get, convertNodeToPath(get().document, nodeId));
  },

  undo: () => {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop()!;
    redoStack.push(get().document);
    set({ document: prev, canUndo: undoStack.length > 0, canRedo: true });
  },

  redo: () => {
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStack.push(get().document);
    set({ document: next, canUndo: true, canRedo: redoStack.length > 0 });
  },

  getNode: (nodeId) => {
    return get().document.nodes[nodeId];
  },

  reset: (doc) => {
    undoStack.length = 0;
    redoStack.length = 0;
    set({ document: doc ?? createDocument('Untitled', 1920, 1080), canUndo: false, canRedo: false });
  },
}));
