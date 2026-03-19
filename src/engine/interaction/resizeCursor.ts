import type { Vec2 } from '@/engine/transform';

type NativeResizeCursor = 'ew-resize' | 'ns-resize' | 'nwse-resize' | 'nesw-resize';

/**
 * Map a world/screen direction vector to the closest native resize cursor.
 * We quantize to 4 axes because CSS only exposes these native cursors.
 */
export function getResizeCursorFromDirection(direction: Vec2): NativeResizeCursor {
  const { x, y } = direction;
  if (x === 0 && y === 0) return 'ew-resize';

  // Periodicity is 180° for bidirectional resize cursors.
  const angle = normalize180(Math.atan2(y, x));
  const step = Math.PI / 4; // 45°
  const bucket = Math.round(angle / step) % 4;

  switch (bucket) {
    case 0:
      return 'ew-resize';
    case 1:
      return 'nwse-resize';
    case 2:
      return 'ns-resize';
    case 3:
      return 'nesw-resize';
    default:
      return 'ew-resize';
  }
}

function normalize180(angleRad: number): number {
  const pi = Math.PI;
  let a = angleRad % pi;
  if (a < 0) a += pi;
  return a;
}

