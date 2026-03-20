import { useEffect, useMemo } from 'react';
import { FederatedPointerEvent, Graphics, Rectangle } from 'pixi.js';
import { create } from 'zustand';

export interface PenPoint {
  readonly x: number;
  readonly y: number;
}

interface PenToolState {
  readonly points: readonly PenPoint[];
  readonly isDrawing: boolean;
  startPath: (point: PenPoint) => void;
  extendPath: (point: PenPoint) => void;
  stopPath: () => void;
  resetPath: () => void;
}

export const usePenToolStore = create<PenToolState>((set) => ({
  points: [],
  isDrawing: false,
  startPath: (point) => set({ points: [point], isDrawing: true }),
  extendPath: (point) =>
    set((state) => {
      if (!state.isDrawing || state.points.length === 0) return state;
      return { points: [...state.points, point] };
    }),
  stopPath: () => set({ isDrawing: false }),
  resetPath: () => set({ points: [], isDrawing: false }),
}));

export interface PixiPenToolPreviewProps {
  readonly width: number;
  readonly height: number;
  readonly graphics: Graphics;
  readonly strokeWidth?: number;
  readonly strokeColor?: number;
}

/**
 * Composant React isolé pour piloter un Graphics PixiJS v8 avec un store Zustand.
 */
export function PixiPenToolPreview({
  width,
  height,
  graphics,
  strokeWidth = 2,
  strokeColor = 0xffffff,
}: PixiPenToolPreviewProps): null {
  const points = usePenToolStore((state) => state.points);
  const startPath = usePenToolStore((state) => state.startPath);
  const extendPath = usePenToolStore((state) => state.extendPath);
  const stopPath = usePenToolStore((state) => state.stopPath);

  const hitArea = useMemo(() => new Rectangle(0, 0, width, height), [width, height]);

  useEffect(() => {
    graphics.eventMode = 'static';
    graphics.cursor = 'crosshair';
    graphics.hitArea = hitArea;

    const onPointerDown = (event: FederatedPointerEvent): void => {
      const local = event.getLocalPosition(graphics);
      startPath({ x: local.x, y: local.y });
    };

    const onPointerMove = (event: FederatedPointerEvent): void => {
      if (!usePenToolStore.getState().isDrawing) return;
      const local = event.getLocalPosition(graphics);
      extendPath({ x: local.x, y: local.y });
    };

    const onPointerUp = (): void => {
      stopPath();
    };

    graphics.on('pointerdown', onPointerDown);
    graphics.on('globalpointermove', onPointerMove);
    graphics.on('pointerup', onPointerUp);
    graphics.on('pointerupoutside', onPointerUp);

    return () => {
      graphics.off('pointerdown', onPointerDown);
      graphics.off('globalpointermove', onPointerMove);
      graphics.off('pointerup', onPointerUp);
      graphics.off('pointerupoutside', onPointerUp);
    };
  }, [extendPath, graphics, hitArea, startPath, stopPath]);

  useEffect(() => {
    // Obligatoire pour un rendu temps réel propre du Pen Tool.
    graphics.clear();

    if (points.length < 2) return;

    const first = points[0];
    if (!first) return;

    graphics.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (!point) continue;
      graphics.lineTo(point.x, point.y);
    }
    graphics.stroke({ width: strokeWidth, color: strokeColor });
  }, [graphics, points, strokeColor, strokeWidth]);

  return null;
}
