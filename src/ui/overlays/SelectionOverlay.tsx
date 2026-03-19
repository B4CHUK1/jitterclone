import { useMemo } from 'react';
import type { Vec2 } from '@/engine/transform';
import { getWorldCorners } from '@/engine/transform';
import type { SceneNode } from '@/document/types';
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
      return { id: rn.node.id, screenCorners, node: rn.node };
    });
  }, [selectedNodes, worldToScreen]);

  return (
    <div className={styles.overlay}>
      {/* Selection outlines + handles */}
      {overlays.map(({ id, screenCorners, node }) => (
        <SelectionBox
          key={id}
          corners={screenCorners}
          node={node}
          onHandlePointerDown={onHandlePointerDown}
        />
      ))}

      {/* Marquee */}
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

function SelectionBox({
  corners,
  node: _node,
  onHandlePointerDown,
}: {
  corners: [Vec2, Vec2, Vec2, Vec2];
  node: SceneNode;
  onHandlePointerDown: (e: React.PointerEvent, handle: string) => void;
}) {
  const [tl, tr, br, bl] = corners;

  // Build SVG outline path
  const pathD = `M${tl.x},${tl.y} L${tr.x},${tr.y} L${br.x},${br.y} L${bl.x},${bl.y} Z`;

  // Midpoints for edge handles
  const midTop = mid(tl, tr);
  const midRight = mid(tr, br);
  const midBottom = mid(br, bl);
  const midLeft = mid(bl, tl);

  // Corner handles
  const cornerHandles = [
    { pos: tl, handle: 'top-left', cursor: 'nwse-resize' },
    { pos: tr, handle: 'top-right', cursor: 'nesw-resize' },
    { pos: br, handle: 'bottom-right', cursor: 'nwse-resize' },
    { pos: bl, handle: 'bottom-left', cursor: 'nesw-resize' },
  ];

  // Edge handles
  const edgeHandles = [
    { pos: midTop, handle: 'top', cursor: 'ns-resize' },
    { pos: midRight, handle: 'right', cursor: 'ew-resize' },
    { pos: midBottom, handle: 'bottom', cursor: 'ns-resize' },
    { pos: midLeft, handle: 'left', cursor: 'ew-resize' },
  ];

  // Rotation handles (offset outward)
  const center = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };
  const rotOffset = 20;
  const rotHandles = [
    { pos: offsetFromCenter(tl, center, rotOffset), handle: 'rotate-top-left' },
    { pos: offsetFromCenter(tr, center, rotOffset), handle: 'rotate-top-right' },
    { pos: offsetFromCenter(br, center, rotOffset), handle: 'rotate-bottom-right' },
    { pos: offsetFromCenter(bl, center, rotOffset), handle: 'rotate-bottom-left' },
  ];

  return (
    <>
      {/* Outline */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <path d={pathD} fill="none" stroke="var(--color-selection)" strokeWidth="1" />
      </svg>

      {/* Corner handles */}
      {cornerHandles.map((h) => (
        <div
          key={h.handle}
          className={styles.handle}
          style={{ left: h.pos.x, top: h.pos.y, cursor: h.cursor }}
          onPointerDown={(e) => onHandlePointerDown(e, h.handle)}
        />
      ))}

      {/* Edge handles (invisible but clickable) */}
      {edgeHandles.map((h) => (
        <div
          key={h.handle}
          className={styles.handle}
          style={{
            left: h.pos.x,
            top: h.pos.y,
            cursor: h.cursor,
            background: 'transparent',
            border: 'none',
            width: 12,
            height: 12,
          }}
          onPointerDown={(e) => onHandlePointerDown(e, h.handle)}
        />
      ))}

      {/* Rotation handles */}
      {rotHandles.map((h) => (
        <div
          key={h.handle}
          className={styles.rotationHandle}
          style={{ left: h.pos.x, top: h.pos.y }}
          onPointerDown={(e) => onHandlePointerDown(e, h.handle)}
        />
      ))}
    </>
  );
}

function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
