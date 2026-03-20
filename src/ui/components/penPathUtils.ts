import type { PathPoint } from '@/document/types';

export interface PenPoint {
  x: number;
  y: number;
  handleInX: number;
  handleInY: number;
  handleOutX: number;
  handleOutY: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function expandBounds(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function cubicBezier1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return (mt ** 3) * p0 + 3 * (mt ** 2) * t * p1 + 3 * mt * (t ** 2) * p2 + (t ** 3) * p3;
}

function cubicDerivativeRoots1D(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;

  if (Math.abs(a) < 1e-8) {
    if (Math.abs(b) < 1e-8) return [];
    return [-c / b];
  }

  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  if (Math.abs(disc) < 1e-8) return [-b / (2 * a)];

  const sqrtDisc = Math.sqrt(disc);
  return [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)];
}

function cubicSegmentBounds(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
): Bounds {
  const bounds: Bounds = {
    minX: Math.min(p0x, p3x),
    minY: Math.min(p0y, p3y),
    maxX: Math.max(p0x, p3x),
    maxY: Math.max(p0y, p3y),
  };

  const tx = cubicDerivativeRoots1D(p0x, p1x, p2x, p3x);
  const ty = cubicDerivativeRoots1D(p0y, p1y, p2y, p3y);

  for (const t of [...tx, ...ty]) {
    if (t > 0 && t < 1) {
      const x = cubicBezier1D(p0x, p1x, p2x, p3x, t);
      const y = cubicBezier1D(p0y, p1y, p2y, p3y, t);
      expandBounds(bounds, x, y);
    }
  }

  return bounds;
}

function computePenAnchorBounds(points: PenPoint[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  const bounds: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  for (const point of points) {
    expandBounds(bounds, point.x, point.y);
  }
  return bounds;
}

export function computePenPathBounds(points: PenPoint[], closed: boolean): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  const bounds: Bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  const segmentCount = closed ? points.length : Math.max(0, points.length - 1);
  for (let i = 0; i < segmentCount; i++) {
    const from = points[i]!;
    const to = points[(i + 1) % points.length]!;

    const p0x = from.x;
    const p0y = from.y;
    const p1x = from.x + from.handleOutX;
    const p1y = from.y + from.handleOutY;
    const p2x = to.x + to.handleInX;
    const p2y = to.y + to.handleInY;
    const p3x = to.x;
    const p3y = to.y;

    const segmentBounds = cubicSegmentBounds(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
    expandBounds(bounds, segmentBounds.minX, segmentBounds.minY);
    expandBounds(bounds, segmentBounds.maxX, segmentBounds.maxY);
  }

  if (!Number.isFinite(bounds.minX)) {
    for (const point of points) {
      expandBounds(bounds, point.x, point.y);
    }
  }

  return bounds;
}

export function normalizePenPath(points: PenPoint[], closed: boolean): {
  transform: { x: number; y: number; width: number; height: number };
  pathData: PathPoint[];
  pathClosed: boolean;
} {
  // Keep normalization anchored to placed points (preview reference frame).
  // Bézier handles stay relative and can extend outside this box without
  // introducing a transform origin shift at finalize/close time.
  const { minX, minY, maxX, maxY } = computePenAnchorBounds(points);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const pathData: PathPoint[] = points.map((point) => ({
    x: (point.x - minX) / width,
    y: (point.y - minY) / height,
    handleInX: point.handleInX / width || undefined,
    handleInY: point.handleInY / height || undefined,
    handleOutX: point.handleOutX / width || undefined,
    handleOutY: point.handleOutY / height || undefined,
  }));

  return {
    transform: {
      x: minX + width / 2,
      y: minY + height / 2,
      width,
      height,
    },
    pathData,
    pathClosed: closed,
  };
}
