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
  readonly animation: NodeAnimation;
  /** Clip start time in seconds (global timeline). Layer is inactive before this. */
  readonly startTime: number;
  /** Clip end time in seconds (global timeline). Layer is inactive after this. */
  readonly endTime: number;
}

export interface Composition {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly duration: number;
  readonly fps: number;
}

export type AnimatableProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity';
export type InterpolationMode = 'linear';

export interface Keyframe {
  readonly time: number;
  readonly value: number;
}

export interface AnimatedProperty {
  readonly animated: boolean;
  readonly keyframes: Keyframe[];
  readonly interpolation: InterpolationMode;
}

export type AnimationTrack = Record<AnimatableProperty, AnimatedProperty>;

export interface NodeAnimation {
  readonly properties: AnimationTrack;
}

export interface Document {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly composition: Composition;
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
    composition: {
      id: generateId(),
      name: 'Main Comp',
      width,
      height,
      background: '#1a1a2e',
      duration: 5,
      fps: 30,
    },
    width,
    height,
    nodes: {},
    rootNodeIds: [],
  };
}

export function defaultNodeAnimation(): NodeAnimation {
  return {
    properties: {
      x: { animated: false, keyframes: [], interpolation: 'linear' },
      y: { animated: false, keyframes: [], interpolation: 'linear' },
      scaleX: { animated: false, keyframes: [], interpolation: 'linear' },
      scaleY: { animated: false, keyframes: [], interpolation: 'linear' },
      rotation: { animated: false, keyframes: [], interpolation: 'linear' },
      opacity: { animated: false, keyframes: [], interpolation: 'linear' },
    },
  };
}
