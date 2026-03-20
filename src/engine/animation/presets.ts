/**
 * Animation presets — pre-built keyframe sequences for common effects.
 * These can be applied to any node as "In", "Out", or "Loop" animations.
 */

import type { AnimatableProperty, EasingPreset, Keyframe } from '@/document/types';

export interface AnimationPreset {
  readonly name: string;
  readonly category: 'in' | 'out' | 'loop';
  readonly duration: number; // seconds
  readonly tracks: {
    property: AnimatableProperty;
    keyframes: Keyframe[];
  }[];
}

function kf(time: number, value: number, easing: EasingPreset = 'linear'): Keyframe {
  return { time, value, easing };
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  // ── IN Animations ──
  {
    name: 'Fade In',
    category: 'in',
    duration: 0.5,
    tracks: [
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.5, 1)] },
    ],
  },
  {
    name: 'Slide From Left',
    category: 'in',
    duration: 0.6,
    tracks: [
      { property: 'x', keyframes: [kf(0, -300, 'ease-out'), kf(0.6, 0)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.3, 1)] },
    ],
  },
  {
    name: 'Slide From Right',
    category: 'in',
    duration: 0.6,
    tracks: [
      { property: 'x', keyframes: [kf(0, 300, 'ease-out'), kf(0.6, 0)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.3, 1)] },
    ],
  },
  {
    name: 'Slide From Top',
    category: 'in',
    duration: 0.6,
    tracks: [
      { property: 'y', keyframes: [kf(0, -300, 'ease-out'), kf(0.6, 0)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.3, 1)] },
    ],
  },
  {
    name: 'Slide From Bottom',
    category: 'in',
    duration: 0.6,
    tracks: [
      { property: 'y', keyframes: [kf(0, 300, 'ease-out'), kf(0.6, 0)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.3, 1)] },
    ],
  },
  {
    name: 'Pop',
    category: 'in',
    duration: 0.4,
    tracks: [
      { property: 'scaleX', keyframes: [kf(0, 0, 'custom'), kf(0.25, 1.15, 'ease-out'), kf(0.4, 1)] },
      { property: 'scaleY', keyframes: [kf(0, 0, 'custom'), kf(0.25, 1.15, 'ease-out'), kf(0.4, 1)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.15, 1)] },
    ],
  },
  {
    name: 'Bounce In',
    category: 'in',
    duration: 0.6,
    tracks: [
      { property: 'scaleX', keyframes: [kf(0, 0.3, 'ease-out'), kf(0.3, 1.1, 'ease-in-out'), kf(0.45, 0.95, 'ease-in-out'), kf(0.6, 1)] },
      { property: 'scaleY', keyframes: [kf(0, 0.3, 'ease-out'), kf(0.3, 1.1, 'ease-in-out'), kf(0.45, 0.95, 'ease-in-out'), kf(0.6, 1)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.15, 1)] },
    ],
  },
  {
    name: 'Spin In',
    category: 'in',
    duration: 0.5,
    tracks: [
      { property: 'rotation', keyframes: [kf(0, -180, 'ease-out'), kf(0.5, 0)] },
      { property: 'scaleX', keyframes: [kf(0, 0, 'ease-out'), kf(0.5, 1)] },
      { property: 'scaleY', keyframes: [kf(0, 0, 'ease-out'), kf(0.5, 1)] },
      { property: 'opacity', keyframes: [kf(0, 0, 'ease-out'), kf(0.2, 1)] },
    ],
  },

  // ── OUT Animations ──
  {
    name: 'Fade Out',
    category: 'out',
    duration: 0.5,
    tracks: [
      { property: 'opacity', keyframes: [kf(0, 1, 'ease-in'), kf(0.5, 0)] },
    ],
  },
  {
    name: 'Slide Out Right',
    category: 'out',
    duration: 0.5,
    tracks: [
      { property: 'x', keyframes: [kf(0, 0, 'ease-in'), kf(0.5, 300)] },
      { property: 'opacity', keyframes: [kf(0.2, 1, 'ease-in'), kf(0.5, 0)] },
    ],
  },
  {
    name: 'Pop Out',
    category: 'out',
    duration: 0.3,
    tracks: [
      { property: 'scaleX', keyframes: [kf(0, 1, 'ease-in'), kf(0.15, 1.1, 'ease-in'), kf(0.3, 0)] },
      { property: 'scaleY', keyframes: [kf(0, 1, 'ease-in'), kf(0.15, 1.1, 'ease-in'), kf(0.3, 0)] },
      { property: 'opacity', keyframes: [kf(0.15, 1, 'ease-in'), kf(0.3, 0)] },
    ],
  },

  // ── LOOP Animations ──
  {
    name: 'Pulse',
    category: 'loop',
    duration: 1.0,
    tracks: [
      { property: 'scaleX', keyframes: [kf(0, 1, 'ease-in-out'), kf(0.5, 1.1, 'ease-in-out'), kf(1, 1)] },
      { property: 'scaleY', keyframes: [kf(0, 1, 'ease-in-out'), kf(0.5, 1.1, 'ease-in-out'), kf(1, 1)] },
    ],
  },
  {
    name: 'Float',
    category: 'loop',
    duration: 2.0,
    tracks: [
      { property: 'y', keyframes: [kf(0, 0, 'ease-in-out'), kf(1, -20, 'ease-in-out'), kf(2, 0)] },
    ],
  },
  {
    name: 'Spin',
    category: 'loop',
    duration: 2.0,
    tracks: [
      { property: 'rotation', keyframes: [kf(0, 0, 'linear'), kf(2, 360)] },
    ],
  },
];

/**
 * Apply a preset to a node starting at a given local time.
 * Returns the keyframes to set, offset by startLocalTime.
 * For "in" presets, the keyframes start at the beginning of the clip.
 * For "out" presets, they end at the clip end.
 * For "loop" presets, they start at the current position.
 */
export function getPresetKeyframes(
  preset: AnimationPreset,
  startLocalTime: number,
  currentStaticValues: Record<AnimatableProperty, number>,
): { property: AnimatableProperty; keyframes: Keyframe[] }[] {
  return preset.tracks.map((track) => ({
    property: track.property,
    keyframes: track.keyframes.map((kf) => {
      // For position/scale properties, offset relative to current value
      const baseValue = currentStaticValues[track.property] ?? 0;
      const isRelative = track.property === 'x' || track.property === 'y';
      return {
        ...kf,
        time: kf.time + startLocalTime,
        value: isRelative ? kf.value + baseValue : kf.value,
      };
    }),
  }));
}
