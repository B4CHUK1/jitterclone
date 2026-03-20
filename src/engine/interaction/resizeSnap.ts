import { computeLocalMatrix, getWorldCorners, type Vec2 } from '@/engine/transform';
import { getBoundsFromPoints, resolveBoundsSnapping, type SnapGuide, type WorldBounds } from '@/engine/interaction/snapEngine';
import { updateResize, type ResizeModifiers, type ResizeState } from '@/engine/interaction/resizeInteraction';

export function resolveResizeSnap(
  state: ResizeState,
  currentWorldPoint: Vec2,
  modifiers: ResizeModifiers,
  proposed: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  staticBounds: readonly WorldBounds[],
  canvasBounds: WorldBounds,
  threshold: number,
): { transform: typeof proposed; guides: SnapGuide[] } {
  if (
    proposed.x == null
    || proposed.y == null
    || proposed.width == null
    || proposed.height == null
    || proposed.width <= 0
    || proposed.height <= 0
  ) {
    return { transform: proposed, guides: [] };
  }

  const candidate = {
    ...state.startTransform,
    ...proposed,
  };
  const movingBounds = getBoundsFromPoints(getWorldCorners(candidate, computeLocalMatrix(candidate)));
  const snap = resolveBoundsSnapping(movingBounds, staticBounds, canvasBounds, threshold);

  if (!snap.snappedX && !snap.snappedY) {
    return { transform: proposed, guides: [] };
  }

  const snappedPointer = {
    x: currentWorldPoint.x + snap.dx,
    y: currentWorldPoint.y + snap.dy,
  };

  return {
    transform: updateResize(state, snappedPointer, modifiers),
    guides: snap.guides,
  };
}
