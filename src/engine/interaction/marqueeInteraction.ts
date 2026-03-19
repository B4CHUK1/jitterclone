/**
 * Marquee (rubber-band) selection interaction.
 */

import type { Vec2 } from '@/engine/transform';
import type { BoundingBox } from '@/engine/transform/math';

export interface MarqueeState {
  readonly startWorld: Vec2;
  readonly currentWorld: Vec2;
}

export function beginMarquee(worldPoint: Vec2): MarqueeState {
  return {
    startWorld: worldPoint,
    currentWorld: worldPoint,
  };
}

export function updateMarquee(state: MarqueeState, currentWorld: Vec2): MarqueeState {
  return { ...state, currentWorld };
}

export function getMarqueeRect(state: MarqueeState): BoundingBox {
  const x = Math.min(state.startWorld.x, state.currentWorld.x);
  const y = Math.min(state.startWorld.y, state.currentWorld.y);
  const width = Math.abs(state.currentWorld.x - state.startWorld.x);
  const height = Math.abs(state.currentWorld.y - state.startWorld.y);
  return { x, y, width, height };
}
