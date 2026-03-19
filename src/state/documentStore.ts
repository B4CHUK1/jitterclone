/**
 * Document store — the source of truth for the scene graph.
 * Holds the serializable document and exposes mutation actions.
 */

import { create } from 'zustand';
import type { Document, NodeType, NodeStyle, SceneNode } from '@/document/types';
import { createDocument } from '@/document/types';
import {
  addNode,
  removeNode,
  updateNodeTransform,
  updateManyNodeTransforms,
  updateNodeStyle,
  updateNodeProps,
} from '@/document/operations';
import type { Transform } from '@/engine/transform';

interface DocumentState {
  document: Document;

  // Actions
  addNode: (type: NodeType, overrides?: Partial<SceneNode>) => string;
  removeNode: (nodeId: string) => void;
  updateTransform: (nodeId: string, updates: Partial<Transform>) => void;
  updateTransforms: (updates: Map<string, Partial<Transform>>) => void;
  updateStyle: (nodeId: string, updates: Partial<NodeStyle>) => void;
  updateProps: (nodeId: string, updates: Partial<Pick<SceneNode, 'name' | 'visible' | 'locked'>>) => void;
  getNode: (nodeId: string) => SceneNode | undefined;
  reset: (doc?: Document) => void;
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

  getNode: (nodeId) => {
    return get().document.nodes[nodeId];
  },

  reset: (doc) => {
    set({ document: doc ?? createDocument('Untitled', 1920, 1080) });
  },
}));
