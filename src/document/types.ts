/**
 * Document model types — the serializable source of truth.
 * This is the "file format", independent of rendering or editing state.
 */

import type { Transform } from '@/engine/transform';

export type NodeType = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'group' | 'path';

export interface Fill {
  readonly color: string;
  readonly opacity: number;
}

export interface Stroke {
  readonly color: string;
  readonly width: number;
  readonly opacity: number;
}

// ── Effects ──

export interface DropShadowEffect {
  readonly type: 'drop-shadow';
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly color: string;
  readonly opacity: number;
}

export interface InnerShadowEffect {
  readonly type: 'inner-shadow';
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly color: string;
  readonly opacity: number;
}

export interface GaussianBlurEffect {
  readonly type: 'blur';
  readonly radius: number;
}

export interface BackgroundBlurEffect {
  readonly type: 'background-blur';
  readonly radius: number;
}

export type Effect = DropShadowEffect | InnerShadowEffect | GaussianBlurEffect | BackgroundBlurEffect;

// ── Blend Modes ──

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

// ── Shape-specific params ──

export interface PathPoint {
  readonly x: number;
  readonly y: number;
}

export interface PolygonParams {
  readonly sides: number; // 3-12
}

export interface StarParams {
  readonly points: number; // 3-12
  readonly innerRadius: number; // 0-1 ratio of outer radius
}

export interface NodeStyle {
  readonly fill: Fill;
  readonly stroke: Stroke | null;
  readonly opacity: number;
  readonly cornerRadius: number;
  readonly effects: Effect[];
  readonly blendMode: BlendMode;
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
  /** Shape-specific parameters */
  readonly polygon?: PolygonParams;
  readonly star?: StarParams;
  /** Free-draw path points (for 'path' type) */
  readonly pathData?: PathPoint[];
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
  readonly workAreaStart: number;
  readonly workAreaEnd: number;
}

export type AnimatableProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity';

// ── Easing System ──

export type EasingPreset = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold' | 'custom';

export interface CubicBezierEasing {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Preset cubic-bezier values */
export const EASING_PRESETS: Record<Exclude<EasingPreset, 'hold' | 'custom'>, CubicBezierEasing> = {
  'linear': { x1: 0, y1: 0, x2: 1, y2: 1 },
  'ease-in': { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
};

export interface Keyframe {
  readonly time: number;
  readonly value: number;
  /** Easing applied from this keyframe to the next. Default: 'linear' */
  readonly easing: EasingPreset;
  /** Custom cubic-bezier control points (only used when easing is 'custom') */
  readonly bezier?: CubicBezierEasing;
}

export interface AnimatedProperty {
  readonly animated: boolean;
  readonly keyframes: Keyframe[];
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
    effects: [],
    blendMode: 'normal',
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
      workAreaStart: 0,
      workAreaEnd: 5,
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
      x: { animated: false, keyframes: [] },
      y: { animated: false, keyframes: [] },
      scaleX: { animated: false, keyframes: [] },
      scaleY: { animated: false, keyframes: [] },
      rotation: { animated: false, keyframes: [] },
      opacity: { animated: false, keyframes: [] },
    },
  };
}
