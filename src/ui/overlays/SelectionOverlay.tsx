import { useMemo } from 'react';
import type { Vec2 } from '@/engine/transform';
import { getWorldCorners } from '@/engine/transform';
import type { RenderNode } from '@/engine/scene';
import styles from './SelectionOverlay.module.css';

interface SelectionOverlayProps {
  selectedNodes: RenderNode[];
  worldToScreen: (p: Vec2) => Vec2;
  onHandlePointerDown: (e: React.PointerEvent, handle: string) => void;
  marqueeScreen: { x: number; y: number; width: number; height: number } | null;
}

export function SelectionOverlay({
  selectedNodes,
  worldToScreen,
  onHandlePointerDown,
  marqueeScreen,
}: SelectionOverlayProps) {
  const overlays = useMemo(() => {
    return selectedNodes.map((rn) => {
      const corners = getWorldCorners(rn.node.transform, rn.worldMatrix);
      const screenCorners = corners.map(worldToScreen) as [Vec2, Vec2, Vec2, Vec2];
      return { id: rn.node.id, screenCorners };
    });
  }, [selectedNodes, worldToScreen]);

  return (
    <div
      className={styles.overlay}
    >
      {overlays.map(({ id, screenCorners }) => (
        <SelectionBox
          key={id}
          corners={screenCorners}
          onHandlePointerDown={onHandlePointerDown}
        />
      ))}

      {marqueeScreen && (
        <div
          className={styles.marquee}
          style={{
            left: marqueeScreen.x,
            top: marqueeScreen.y,
            width: marqueeScreen.width,
            height: marqueeScreen.height,
          }}
        />
      )}
    </div>
  );
}

// ── Edge hit area config ──
const EDGE_HIT_THICKNESS = 10; // px on each side of the edge line

function SelectionBox({
  corners,
  onHandlePointerDown,
}: {
  corners: [Vec2, Vec2, Vec2, Vec2];
  onHandlePointerDown: (e: React.PointerEvent, handle: string) => void;
}) {
  const [tl, tr, br, bl] = corners;

  // SVG outline path
  const pathD = `M${tl.x},${tl.y} L${tr.x},${tr.y} L${br.x},${br.y} L${bl.x},${bl.y} Z`;

  // Edge definitions: each edge is a line segment from start to end
  const edges = [
    { handle: 'top', a: tl, b: tr, cursor: 'ns-resize' },
    { handle: 'right', a: tr, b: br, cursor: 'ew-resize' },
    { handle: 'bottom', a: br, b: bl, cursor: 'ns-resize' },
    { handle: 'left', a: bl, b: tl, cursor: 'ew-resize' },
  ];

  // Corner handles
  const cornerHandles = [
    { pos: tl, handle: 'top-left', cursor: 'nwse-resize' },
    { pos: tr, handle: 'top-right', cursor: 'nesw-resize' },
    { pos: br, handle: 'bottom-right', cursor: 'nwse-resize' },
    { pos: bl, handle: 'bottom-left', cursor: 'nesw-resize' },
  ];

  // Rotation handles — offset outward from corners
  const center = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };
  const rotOffset = 22;
  const rotHandles = [
    { pos: offsetFromCenter(tl, center, rotOffset), handle: 'rotate-top-left' },
    { pos: offsetFromCenter(tr, center, rotOffset), handle: 'rotate-top-right' },
    { pos: offsetFromCenter(br, center, rotOffset), handle: 'rotate-bottom-right' },
    { pos: offsetFromCenter(bl, center, rotOffset), handle: 'rotate-bottom-left' },
  ];

  return (
    <>
      {/* Bounding box outline */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <path d={pathD} fill="none" stroke="var(--color-selection)" strokeWidth="1.5" />
      </svg>

      {/* Edge hit areas — full-length strips along each edge */}
      {edges.map((edge) => (
        <EdgeHitArea
          key={edge.handle}
          a={edge.a}
          b={edge.b}
          cursor={edge.cursor}
          onPointerDown={(e) => onHandlePointerDown(e, edge.handle)}
        />
      ))}

      {/* Corner handles — visible squares */}
      {cornerHandles.map((h) => (
        <div
          key={h.handle}
          className={styles.cornerHandle}
          style={{ left: h.pos.x, top: h.pos.y, cursor: h.cursor }}
          onPointerDown={(e) => onHandlePointerDown(e, h.handle)}
        />
      ))}

      {/* Rotation handles — invisible circles outside corners */}
      {rotHandles.map((h) => (
        <div
          key={h.handle}
          className={styles.rotationHit}
          style={{ left: h.pos.x, top: h.pos.y }}
          onPointerDown={(e) => onHandlePointerDown(e, h.handle)}
        />
      ))}
    </>
  );
}

/**
 * Edge hit area: a rotated rectangle spanning the full edge length.
 * Uses CSS transform to position and rotate a div along the edge.
 */
function EdgeHitArea({
  a,
  b,
  cursor,
  onPointerDown,
}: {
  a: Vec2;
  b: Vec2;
  cursor: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  // Inset the edge slightly so corners take priority
  const inset = 10;
  const effectiveLength = Math.max(0, length - inset * 2);

  return (
    <div
      className={styles.edgeHit}
      style={{
        left: midX,
        top: midY,
        width: effectiveLength,
        height: EDGE_HIT_THICKNESS * 2,
        transform: `translate(-50%, -50%) rotate(${angle}rad)`,
        cursor,
      }}
      onPointerDown={onPointerDown}
    />
  );
}

function offsetFromCenter(corner: Vec2, center: Vec2, offset: number): Vec2 {
  const dx = corner.x - center.x;
  const dy = corner.y - center.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return corner;
  const factor = (len + offset) / len;
  return {
    x: center.x + dx * factor,
    y: center.y + dy * factor,
  };
}
