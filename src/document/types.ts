/**
 * Document model types — the serializable source of truth.
 * This is the "file format", independent of rendering or editing state.
 */

import type { Transform } from '@/engine/transform';

export type NodeType = 'rectangle' | 'ellipse' | 'group';

export interface Fill {
  readonly color: string;
  readonly opacity: number;
}

export interface Stroke {
  readonly color: string;
  readonly width: number;
  readonly opacity: number;
}

export interface NodeStyle {
  readonly fill: Fill;
  readonly stroke: Stroke | null;
  readonly opacity: number;
  readonly cornerRadius: number;
}

export interface SceneNode {
  readonly id: string;
  readonly type: NodeType;
  readonly name: string;
  readonly parentId: string | null;
  readonly order: number; // z-order within parent
  readonly transform: Transform;
  readonly style: NodeStyle;
  readonly visible: boolean;
  readonly locked: boolean;
}

export interface Document {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly nodes: Record<string, SceneNode>;
  readonly rootNodeIds: string[];
}

export function defaultFill(): Fill {
  return { color: '#5B8DEF', opacity: 1 };
}

export function defaultStroke(): Stroke | null {
  return null;
}

export function defaultStyle(): NodeStyle {
  return {
    fill: defaultFill(),
    stroke: defaultStroke(),
    opacity: 1,
    cornerRadius: 0,
  };
}

let _idCounter = 0;
export function generateId(): string {
  _idCounter++;
  return `node_${Date.now()}_${_idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDocument(name: string, width = 1920, height = 1080): Document {
  return {
    id: generateId(),
    name,
    width,
    height,
    nodes: {},
    rootNodeIds: [],
  };
}
