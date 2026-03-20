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
  Document,
  NodeType,
  NodeStyle,
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
} from '@/document/operations';
import type { Transform } from '@/engine/transform';
import {
  applyStaticValueToNode,
  evaluateNodeAtTime,
  globalToLocalTime,
  clampKeyframeTime,
} from '@/engine/animation';

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
    updates: Partial<Pick<Document['composition'], 'name' | 'width' | 'height' | 'background' | 'duration' | 'fps'>>,
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

  /** Update clip timing (startTime/endTime) */
  updateTiming: (nodeId: string, updates: { startTime?: number; endTime?: number }) => void;

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

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: createDocument('Untitled', 1920, 1080),

  addNode: (type, overrides) => {
    const result = addNode(get().document, type, overrides);
    set({ document: result.doc });
    return result.nodeId;
  },

  removeNode: (nodeId) => {
    set({ document: removeNode(get().document, nodeId) });
  },

  updateTransform: (nodeId, updates) => {
    set({ document: updateNodeTransform(get().document, nodeId, updates) });
  },

  updateTransforms: (updates) => {
    set({ document: updateManyNodeTransforms(get().document, updates) });
  },

  updateStyle: (nodeId, updates) => {
    set({ document: updateNodeStyle(get().document, nodeId, updates) });
  },

  updateProps: (nodeId, updates) => {
    set({ document: updateNodeProps(get().document, nodeId, updates) });
  },

  updateComposition: (updates) => {
    set({ document: updateComposition(get().document, updates) });
  },

  setKeyframe: (nodeId, property, localTime, value) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const clamped = clampKeyframeTime(localTime, node);
    set({
      document: setNodeKeyframe(doc, nodeId, property, { time: clamped, value }),
    });
  },

  removeKeyframe: (nodeId, property, localTime) => {
    set({
      document: removeNodeKeyframe(get().document, nodeId, property, localTime),
    });
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
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: clamped, value: keyframe.value });
    set({ document: nextDoc });
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

    // If the property is animated, insert/update keyframe at this time
    if (propertyState.animated) {
      const localTime = clampKeyframeTime(globalToLocalTime(globalTime, node), node);
      nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: localTime, value });
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
      nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: localTime, value });
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
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: localTime, value });
    set({ document: nextDoc });
  },

  updateTiming: (nodeId, updates) => {
    set({ document: updateNodeTiming(get().document, nodeId, updates) });
  },

  getNode: (nodeId) => {
    return get().document.nodes[nodeId];
  },

  reset: (doc) => {
    set({ document: doc ?? createDocument('Untitled', 1920, 1080) });
  },
}));
