/**
 * PathEditOverlay — SVG overlay for vector/path editing mode.
 * Renders anchor points and Bézier handles for a node's pathData.
 * All pointer event handling happens in Canvas.tsx; this is display-only.
 */

import type { SceneNode } from '@/document/types';
import type { Matrix2D, Vec2 } from '@/engine/transform';

export interface PathEditHitTarget {
  type: 'anchor';
  index: number;
  handleType?: never;
}

export interface PathEditHandleHitTarget {
  type: 'handle';
  index: number;
  handleType: 'in' | 'out';
}

export type PathEditTarget = PathEditHitTarget | PathEditHandleHitTarget;

interface Props {
  node: SceneNode;
  worldMatrix: Matrix2D;
  worldToScreen: (world: Vec2) => Vec2;
  /** Index of the currently dragged anchor (-1 = none) */
  activeAnchorIndex?: number;
  /** Handle currently being dragged */
  activeHandle?: { index: number; type: 'in' | 'out' } | null;
  /** Anchors selected via shift-click or marquee */
  selectedAnchorIndices?: Set<number>;
  /** Marquee rect for path-edit box selection (screen coords) */
  marqueeScreen?: { x: number; y: number; width: number; height: number } | null;
}

/** Convert a normalized path point to world coordinates using the node transform and worldMatrix */
export function pathPointToWorld(
  px: number,
  py: number,
  node: SceneNode,
  worldMatrix: Matrix2D,
): Vec2 {
  const { width, height } = node.transform;
  const localX = px * width;
  const localY = py * height;
  return {
    x: worldMatrix.a * localX + worldMatrix.c * localY + worldMatrix.tx,
    y: worldMatrix.b * localX + worldMatrix.d * localY + worldMatrix.ty,
  };
}

/** Hit-test path anchors and handles in screen space. Returns the first match. */
export function hitTestPathEdit(
  node: SceneNode,
  worldMatrix: Matrix2D,
  worldToScreen: (v: Vec2) => Vec2,
  screenPt: Vec2,
  radius = 8,
): PathEditTarget | null {
  const pathData = node.pathData;
  if (!pathData || pathData.length === 0) return null;

  const r2 = radius * radius;

  // Test handles first (they're smaller targets, test before anchors)
  for (let i = 0; i < pathData.length; i++) {
    const pt = pathData[i]!;
    const anchorWorld = pathPointToWorld(pt.x, pt.y, node, worldMatrix);

    if (pt.handleOutX !== undefined && pt.handleOutY !== undefined &&
        (pt.handleOutX !== 0 || pt.handleOutY !== 0)) {
      const hWorld = pathPointToWorld(
        pt.x + pt.handleOutX,
        pt.y + pt.handleOutY,
        node,
        worldMatrix,
      );
      const hScreen = worldToScreen(hWorld);
      const dx = hScreen.x - screenPt.x;
      const dy = hScreen.y - screenPt.y;
      if (dx * dx + dy * dy <= r2) {
        return { type: 'handle', index: i, handleType: 'out' };
      }
    }

    if (pt.handleInX !== undefined && pt.handleInY !== undefined &&
        (pt.handleInX !== 0 || pt.handleInY !== 0)) {
      const hWorld = pathPointToWorld(
        pt.x + pt.handleInX,
        pt.y + pt.handleInY,
        node,
        worldMatrix,
      );
      const hScreen = worldToScreen(hWorld);
      const dx = hScreen.x - screenPt.x;
      const dy = hScreen.y - screenPt.y;
      if (dx * dx + dy * dy <= r2) {
        return { type: 'handle', index: i, handleType: 'in' };
      }
    }

    // Test anchor
    const aScreen = worldToScreen(anchorWorld);
    const dx = aScreen.x - screenPt.x;
    const dy = aScreen.y - screenPt.y;
    if (dx * dx + dy * dy <= r2 * 1.5) {
      return { type: 'anchor', index: i };
    }
  }

  return null;
}

export function PathEditOverlay({
  node,
  worldMatrix,
  worldToScreen,
  activeAnchorIndex = -1,
  activeHandle = null,
  selectedAnchorIndices,
  marqueeScreen = null,
}: Props) {
  const pathData = node.pathData;
  if (!pathData || pathData.length === 0) return null;

  const anchorScreenPts = pathData.map((pt) => {
    const world = pathPointToWorld(pt.x, pt.y, node, worldMatrix);
    return worldToScreen(world);
  });

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Bezier handle lines and circles */}
      {pathData.map((pt, i) => {
        const anchor = anchorScreenPts[i]!;
        const elements: React.ReactNode[] = [];

        if (pt.handleOutX !== undefined && pt.handleOutY !== undefined &&
            (pt.handleOutX !== 0 || pt.handleOutY !== 0)) {
          const hWorld = pathPointToWorld(
            pt.x + pt.handleOutX,
            pt.y + pt.handleOutY,
            node,
            worldMatrix,
          );
          const hScreen = worldToScreen(hWorld);
          const isActive = activeHandle?.index === i && activeHandle.type === 'out';
          elements.push(
            <line
              key={`hout-line-${i}`}
              x1={anchor.x} y1={anchor.y}
              x2={hScreen.x} y2={hScreen.y}
              stroke="#aaa" strokeWidth="1" opacity="0.7"
            />,
            <circle
              key={`hout-${i}`}
              cx={hScreen.x} cy={hScreen.y} r={isActive ? 5 : 4}
              fill={isActive ? '#ff9f43' : '#ff6b6b'}
              stroke="#fff" strokeWidth="1"
            />,
          );
        }

        if (pt.handleInX !== undefined && pt.handleInY !== undefined &&
            (pt.handleInX !== 0 || pt.handleInY !== 0)) {
          const hWorld = pathPointToWorld(
            pt.x + pt.handleInX,
            pt.y + pt.handleInY,
            node,
            worldMatrix,
          );
          const hScreen = worldToScreen(hWorld);
          const isActive = activeHandle?.index === i && activeHandle.type === 'in';
          elements.push(
            <line
              key={`hin-line-${i}`}
              x1={anchor.x} y1={anchor.y}
              x2={hScreen.x} y2={hScreen.y}
              stroke="#aaa" strokeWidth="1" opacity="0.7"
            />,
            <circle
              key={`hin-${i}`}
              cx={hScreen.x} cy={hScreen.y} r={isActive ? 5 : 4}
              fill={isActive ? '#ff9f43' : '#ff6b6b'}
              stroke="#fff" strokeWidth="1"
            />,
          );
        }

        return <g key={`handles-${i}`}>{elements}</g>;
      })}

      {/* Anchor squares */}
      {anchorScreenPts.map((s, i) => {
        const isActive = activeAnchorIndex === i;
        const isSelected = selectedAnchorIndices?.has(i) ?? false;
        const size = isActive ? 10 : 8;
        return (
          <rect
            key={`anchor-${i}`}
            x={s.x - size / 2}
            y={s.y - size / 2}
            width={size}
            height={size}
            fill={isActive ? '#4dabf7' : isSelected ? '#228be6' : '#fff'}
            stroke={isActive ? '#228be6' : isSelected ? '#1971c2' : '#4dabf7'}
            strokeWidth="1.5"
          />
        );
      })}

      {/* Marquee selection rect */}
      {marqueeScreen && (
        <rect
          x={marqueeScreen.x}
          y={marqueeScreen.y}
          width={marqueeScreen.width}
          height={marqueeScreen.height}
          fill="rgba(74, 144, 226, 0.1)"
          stroke="#4a90e2"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
      )}
    </svg>
  );
}
