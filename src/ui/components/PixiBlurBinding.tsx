import { useEffect, useMemo } from 'react';
import { BlurFilter, Container, Graphics } from 'pixi.js';
import { create } from 'zustand';

interface BlurState {
  readonly blurRadius: number;
  setBlurRadius: (value: number) => void;
}

export const useBlurStore = create<BlurState>((set) => ({
  blurRadius: 0,
  setBlurRadius: (value) => set({ blurRadius: Math.max(0, value) }),
}));

export interface PixiBlurBindingProps {
  readonly target: Container | Graphics;
  readonly quality?: number;
}

/**
 * Lie la valeur Zustand `blurRadius` à un BlurFilter PixiJS v8 en temps réel.
 */
export function PixiBlurBinding({ target, quality = 4 }: PixiBlurBindingProps): null {
  const blurRadius = useBlurStore((state) => state.blurRadius);

  const blurFilter = useMemo(
    () =>
      new BlurFilter({
        strength: 0,
        quality,
      }),
    [quality],
  );

  useEffect(() => {
    return () => {
      blurFilter.destroy();
    };
  }, [blurFilter]);

  useEffect(() => {
    blurFilter.strength = blurRadius;

    if (blurRadius > 0) {
      target.filters = [blurFilter];
      return;
    }

    target.filters = [];
  }, [blurFilter, blurRadius, target]);

  return null;
}
