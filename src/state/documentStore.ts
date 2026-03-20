/**
 * Document store — the source of truth for the scene graph.
 * Holds the serializable document and exposes mutation actions.
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
} from '@/document/operations';
import type { Transform } from '@/engine/transform';
import { applyStaticValueToNode, evaluateNodeAtTime } from '@/engine/animation';

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
  setKeyframe: (nodeId: string, property: AnimatableProperty, time: number, value: number) => void;
  removeKeyframe: (nodeId: string, property: AnimatableProperty, time: number) => void;
  moveKeyframe: (
    nodeId: string,
    property: AnimatableProperty,
    fromTime: number,
    toTime: number,
  ) => void;
  setAnimatableValue: (
    nodeId: string,
    property: AnimatableProperty,
    value: number,
    time: number,
    _autoKeyframe: boolean,
  ) => void;
  togglePropertyStopwatch: (nodeId: string, property: AnimatableProperty, time: number) => void;
  addKeyframeAtCurrentTime: (nodeId: string, property: AnimatableProperty, time: number) => void;
  getNode: (nodeId: string) => SceneNode | undefined;
  reset: (doc?: Document) => void;
}

function getEvaluatedAnimatableValue(
  node: SceneNode,
  property: AnimatableProperty,
  time: number,
): number {
  const evaluated = evaluateNodeAtTime(node, time);
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
  setKeyframe: (nodeId, property, time, value) => {
    set({
      document: setNodeKeyframe(get().document, nodeId, property, { time, value }),
    });
  },
  removeKeyframe: (nodeId, property, time) => {
    set({
      document: removeNodeKeyframe(get().document, nodeId, property, time),
    });
  },
  moveKeyframe: (nodeId, property, fromTime, toTime) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const keyframe = node.animation.properties[property].keyframes.find(
      (key) => Math.abs(key.time - fromTime) < 1e-6,
    );
    if (!keyframe) return;
    let nextDoc = removeNodeKeyframe(doc, nodeId, property, fromTime);
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time: toTime, value: keyframe.value });
    set({ document: nextDoc });
  },
  setAnimatableValue: (nodeId, property, value, time, _autoKeyframe) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const propertyState = node.animation.properties[property];

    let nextDoc = {
      ...doc,
      nodes: {
        ...doc.nodes,
        [nodeId]: applyStaticValueToNode(node, property, value),
      },
    };

    const shouldKey = propertyState.animated;
    if (shouldKey) {
      if (!propertyState.animated) {
        const baseValue = getEvaluatedAnimatableValue(node, property, time);
        nextDoc = setNodePropertyAnimation(nextDoc, nodeId, property, {
          animated: true,
          keyframes: [{ time, value: baseValue }],
        });
      }
      nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time, value });
    }

    set({ document: nextDoc });
  },
  togglePropertyStopwatch: (nodeId, property, time) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const propertyState = node.animation.properties[property];

    if (!propertyState.animated) {
      const value = getEvaluatedAnimatableValue(node, property, time);
      let nextDoc = setNodePropertyAnimation(doc, nodeId, property, {
        animated: true,
        keyframes: [],
      });
      nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time, value });
      set({ document: nextDoc });
      return;
    }

    const value = getEvaluatedAnimatableValue(node, property, time);
    let nextDoc = {
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
  addKeyframeAtCurrentTime: (nodeId, property, time) => {
    const doc = get().document;
    const node = doc.nodes[nodeId];
    if (!node) return;
    const value = getEvaluatedAnimatableValue(node, property, time);
    let nextDoc = doc;
    if (!node.animation.properties[property].animated) {
      nextDoc = setNodePropertyAnimation(nextDoc, nodeId, property, { animated: true, keyframes: [] });
    }
    nextDoc = setNodeKeyframe(nextDoc, nodeId, property, { time, value });
    set({ document: nextDoc });
  },

  getNode: (nodeId) => {
    return get().document.nodes[nodeId];
  },

  reset: (doc) => {
    set({ document: doc ?? createDocument('Untitled', 1920, 1080) });
  },
}));
