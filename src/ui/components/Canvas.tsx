import { useRef, useEffect, useCallback, useState } from 'react';
import { PixiRenderer } from '@/engine/renderer';
import { buildSceneGraph, findRenderNode } from '@/engine/scene';
import { hitTestPoint, hitTestRect } from '@/engine/interaction/hitTest';
import { beginDrag, updateDrag } from '@/engine/interaction/dragInteraction';
import {
  beginResize,
  updateResize,
  type ResizeModifiers,
} from '@/engine/interaction/resizeInteraction';
import { beginRotate, updateRotate } from '@/engine/interaction/rotateInteraction';
import {
  beginMarquee,
  updateMarquee,
  getMarqueeRect,
} from '@/engine/interaction/marqueeInteraction';
import type { DragState } from '@/engine/interaction/dragInteraction';
import type { ResizeState } from '@/engine/interaction/resizeInteraction';
import type { RotateState } from '@/engine/interaction/rotateInteraction';
import type { MarqueeState } from '@/engine/interaction/marqueeInteraction';
import type { ResizeHandle } from '@/state/editorStore';
import type { RenderNode } from '@/engine/scene';
import type { Vec2 } from '@/engine/transform';
import { getWorldCorners } from '@/engine/transform';
import { useDocumentStore, useEditorStore, useViewportStore } from '@/state';
import { SelectionOverlay } from '@/ui/overlays/SelectionOverlay';
import styles from './Canvas.module.css';

// ── Drag threshold to distinguish click from drag ──
const DRAG_THRESHOLD = 3; // pixels

// ── Interaction state machine ──
type InteractionPhase =
  | 'idle'
  | 'pending-drag'     // pointerdown on element, waiting for threshold
  | 'pending-marquee'  // pointerdown on empty, waiting for threshold
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'marquee'
  | 'panning';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);

  // ── Interaction state (refs to avoid re-renders during gestures) ──
  const phaseRef = useRef<InteractionPhase>('idle');
  const pointerIdRef = useRef<number | null>(null);
  const startClientRef = useRef<Vec2>({ x: 0, y: 0 });
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const rotateStateRef = useRef<RotateState | null>(null);
  const marqueeStateRef = useRef<MarqueeState | null>(null);
  const lastPanPointRef = useRef<Vec2>({ x: 0, y: 0 });
  // Store the hit node id for pending-drag (so we can select + drag after threshold)
  const pendingHitIdRef = useRef<string | null>(null);
  const pendingShiftRef = useRef(false);

  // ── Cursor state ──
  const [interactionCursor, setInteractionCursor] = useState<string | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');

  // Force re-render for overlay updates
  const [, setRenderTick] = useState(0);
  const tick = useCallback(() => setRenderTick((t) => t + 1), []);

  const doc = useDocumentStore((s) => s.document);
  const updateTransform = useDocumentStore((s) => s.updateTransform);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const selectMultiple = useEditorStore((s) => s.selectMultiple);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const activeTool = useEditorStore((s) => s.activeTool);

  const zoom = useViewportStore((s) => s.zoom);
  const panX = useViewportStore((s) => s.panX);
  const panY = useViewportStore((s) => s.panY);
  const zoomAtPoint = useViewportStore((s) => s.zoomAtPoint);
  const pan = useViewportStore((s) => s.pan);
  const setContainerSize = useViewportStore((s) => s.setContainerSize);
  const resetView = useViewportStore((s) => s.resetView);
  const screenToWorld = useViewportStore((s) => s.screenToWorld);
  const worldToScreen = useViewportStore((s) => s.worldToScreen);

  // ── Helpers ──
  const getScene = useCallback(() => buildSceneGraph(doc), [doc]);

  const clientToScreen = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const rect = containerRef.current?.getBoundingClientRect();
      return rect
        ? { x: clientX - rect.left, y: clientY - rect.top }
        : { x: clientX, y: clientY };
    },
    [],
  );

  /** Clean up all interaction state and release pointer capture */
  const resetInteraction = useCallback(
    (pointerId?: number) => {
      phaseRef.current = 'idle';
      dragStateRef.current = null;
      resizeStateRef.current = null;
      rotateStateRef.current = null;
      marqueeStateRef.current = null;
      pendingHitIdRef.current = null;
      setInteractionCursor(null);
      setMarqueeScreenRect(null);

      if (pointerId != null && pointerIdRef.current === pointerId) {
        try {
          containerRef.current?.releasePointerCapture(pointerId);
        } catch {
          // already released
        }
      }
      pointerIdRef.current = null;
      tick();
    },
    [tick],
  );

  // ── Init renderer ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new PixiRenderer();
    rendererRef.current = renderer;

    const rect = container.getBoundingClientRect();
    renderer
      .init({
        canvas,
        width: rect.width,
        height: rect.height,
        backgroundColor: 0x0d0d12,
      })
      .then(() => {
        setContainerSize(rect.width, rect.height);
        resetView(doc.width, doc.height);
        tick();
      });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.resize(width, height);
        setContainerSize(width, height);
        tick();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render loop ──
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer?.ready) return;

    renderer.setViewportTransform(panX, panY, zoom);
    renderer.renderDocBackground(doc.width, doc.height);

    const sceneRoots = buildSceneGraph(doc);
    renderer.render(sceneRoots);
  }, [doc, panX, panY, zoom]);

  // ── Marquee rect for overlay ──
  const [marqueeScreenRect, setMarqueeScreenRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // ── Wheel handler ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const screen = clientToScreen(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        zoomAtPoint(-e.deltaY * 0.003, screen);
      } else {
        pan(-e.deltaX, -e.deltaY);
      }
      tick();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [clientToScreen, zoomAtPoint, pan, tick]);

  // ── Hover cursor: determine cursor from what's under the pointer ──
  const updateHoverCursor = useCallback(
    (clientX: number, clientY: number) => {
      if (phaseRef.current !== 'idle') return;

      const screen = clientToScreen(clientX, clientY);

      // Check if hovering over a handle of the selected element
      if (selectedIds.size > 0) {
        const scene = getScene();
        for (const id of selectedIds) {
          const rn = findRenderNode(scene, id);
          if (!rn) continue;

          const corners = getWorldCorners(rn.node.transform, rn.worldMatrix);
          const screenCorners = corners.map(worldToScreen) as [Vec2, Vec2, Vec2, Vec2];

          const handleHit = hitTestScreenHandles(screenCorners, screen);
          if (handleHit) {
            setHoverCursor(handleHit.cursor);
            return;
          }
        }
      }

      // Check if hovering over an element body
      const world = screenToWorld(screen);
      const scene = getScene();
      const hit = hitTestPoint(scene, world);
      if (hit) {
        setHoverCursor(selectedIds.has(hit.node.id) ? 'move' : 'default');
      } else {
        setHoverCursor('default');
      }
    },
    [clientToScreen, selectedIds, getScene, worldToScreen, screenToWorld],
  );

  // ── POINTER DOWN on canvas ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Middle button or Alt+click = pan
      if (e.button === 1 || (e.button === 0 && (activeTool === 'hand' || e.altKey))) {
        phaseRef.current = 'panning';
        pointerIdRef.current = e.pointerId;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        containerRef.current?.setPointerCapture(e.pointerId);
        setInteractionCursor('grabbing');
        return;
      }

      if (e.button !== 0) return;

      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);
      const scene = getScene();
      const hit = hitTestPoint(scene, world);

      startClientRef.current = { x: e.clientX, y: e.clientY };
      pointerIdRef.current = e.pointerId;
      containerRef.current?.setPointerCapture(e.pointerId);

      if (hit) {
        // Clicked on an element — enter pending-drag (wait for threshold)
        pendingHitIdRef.current = hit.node.id;
        pendingShiftRef.current = e.shiftKey;
        phaseRef.current = 'pending-drag';
      } else {
        // Clicked empty space — enter pending-marquee
        if (!e.shiftKey) {
          deselectAll();
        }
        pendingShiftRef.current = e.shiftKey;
        phaseRef.current = 'pending-marquee';
      }

      tick();
    },
    [activeTool, clientToScreen, screenToWorld, getScene, deselectAll, tick],
  );

  // ── POINTER MOVE ──
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const phase = phaseRef.current;

      // Always update hover cursor when idle
      if (phase === 'idle') {
        updateHoverCursor(e.clientX, e.clientY);
        return;
      }

      if (phase === 'panning') {
        const dx = e.clientX - lastPanPointRef.current.x;
        const dy = e.clientY - lastPanPointRef.current.y;
        pan(dx, dy);
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        tick();
        return;
      }

      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);

      // ── Pending states: check drag threshold ──
      if (phase === 'pending-drag' || phase === 'pending-marquee') {
        const dx = e.clientX - startClientRef.current.x;
        const dy = e.clientY - startClientRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

        if (phase === 'pending-drag') {
          // Threshold crossed → commit selection and start drag
          const hitId = pendingHitIdRef.current;
          if (hitId) {
            if (pendingShiftRef.current) {
              toggleSelect(hitId);
            } else if (!selectedIds.has(hitId)) {
              select(hitId);
            }

            const currentSelected = pendingShiftRef.current
              ? new Set([...selectedIds, hitId])
              : selectedIds.has(hitId)
                ? selectedIds
                : new Set([hitId]);

            const startWorld = screenToWorld(clientToScreen(startClientRef.current.x, startClientRef.current.y));
            dragStateRef.current = beginDrag(startWorld, currentSelected, (id) => doc.nodes[id]?.transform);
            phaseRef.current = 'dragging';
            setInteractionCursor('grabbing');
          }
        } else {
          // Threshold crossed → start marquee
          const startWorld = screenToWorld(clientToScreen(startClientRef.current.x, startClientRef.current.y));
          marqueeStateRef.current = beginMarquee(startWorld);
          phaseRef.current = 'marquee';
          setInteractionCursor('crosshair');
        }
      }

      // ── Active interactions ──
      if (phaseRef.current === 'dragging' && dragStateRef.current) {
        const updates = updateDrag(dragStateRef.current, world);
        for (const [id, pos] of updates) {
          updateTransform(id, pos);
        }
        tick();
        return;
      }

      if (phaseRef.current === 'resizing' && resizeStateRef.current) {
        const mods: ResizeModifiers = { shift: e.shiftKey, alt: e.altKey };
        const updates = updateResize(resizeStateRef.current, world, mods);
        updateTransform(resizeStateRef.current.nodeId, updates);
        tick();
        return;
      }

      if (phaseRef.current === 'rotating' && rotateStateRef.current) {
        const updates = updateRotate(rotateStateRef.current, world, e.shiftKey);
        updateTransform(rotateStateRef.current.nodeId, updates);
        tick();
        return;
      }

      if (phaseRef.current === 'marquee' && marqueeStateRef.current) {
        marqueeStateRef.current = updateMarquee(marqueeStateRef.current, world);
        const rect = getMarqueeRect(marqueeStateRef.current);

        const screenMin = worldToScreen({ x: rect.x, y: rect.y });
        const screenMax = worldToScreen({
          x: rect.x + rect.width,
          y: rect.y + rect.height,
        });
        setMarqueeScreenRect({
          x: Math.min(screenMin.x, screenMax.x),
          y: Math.min(screenMin.y, screenMax.y),
          width: Math.abs(screenMax.x - screenMin.x),
          height: Math.abs(screenMax.y - screenMin.y),
        });

        const scene = getScene();
        const hits = hitTestRect(scene, rect);
        selectMultiple(hits.map((h) => h.node.id));
        tick();
        return;
      }
    },
    [
      updateHoverCursor,
      pan,
      clientToScreen,
      screenToWorld,
      worldToScreen,
      selectedIds,
      select,
      toggleSelect,
      doc.nodes,
      updateTransform,
      getScene,
      selectMultiple,
      tick,
    ],
  );

  // ── POINTER UP ──
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const phase = phaseRef.current;

      // If still in pending-drag (threshold not crossed) → treat as click
      if (phase === 'pending-drag') {
        const hitId = pendingHitIdRef.current;
        if (hitId) {
          if (pendingShiftRef.current) {
            toggleSelect(hitId);
          } else {
            select(hitId);
          }
        }
      }

      // If still in pending-marquee (threshold not crossed) → already deselected
      // Nothing more to do.

      resetInteraction(e.pointerId);
    },
    [select, toggleSelect, resetInteraction],
  );

  // ── Pointer cancel / lost capture — safety cleanup ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cleanup = () => {
      if (phaseRef.current !== 'idle') {
        resetInteraction(pointerIdRef.current ?? undefined);
      }
    };

    container.addEventListener('pointercancel', cleanup);
    container.addEventListener('lostpointercapture', cleanup);
    // Also handle pointer up outside window
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('blur', cleanup);

    return () => {
      container.removeEventListener('pointercancel', cleanup);
      container.removeEventListener('lostpointercapture', cleanup);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('blur', cleanup);
    };
  }, [resetInteraction]);

  // ── Handle pointer down on selection handles (from overlay) ──
  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();

      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);

      const nodeId = [...selectedIds][0];
      if (!nodeId) return;
      const node = doc.nodes[nodeId];
      if (!node) return;

      pointerIdRef.current = e.pointerId;
      containerRef.current?.setPointerCapture(e.pointerId);

      if (handle.startsWith('rotate-')) {
        rotateStateRef.current = beginRotate(world, nodeId, node.transform);
        phaseRef.current = 'rotating';
        setInteractionCursor('grabbing');
      } else {
        resizeStateRef.current = beginResize(
          handle as ResizeHandle,
          world,
          nodeId,
          node.transform,
        );
        phaseRef.current = 'resizing';
        // Set cursor matching the handle direction
        setInteractionCursor(getResizeCursor(handle));
      }
    },
    [clientToScreen, screenToWorld, selectedIds, doc.nodes],
  );

  // ── Selected render nodes for overlay ──
  const selectedRenderNodes: RenderNode[] = (() => {
    const scene = getScene();
    const nodes: RenderNode[] = [];
    for (const id of selectedIds) {
      const rn = findRenderNode(scene, id);
      if (rn) nodes.push(rn);
    }
    return nodes;
  })();

  // ── Compute effective cursor ──
  const effectiveCursor = interactionCursor ?? hoverCursor;

  return (
    <div
      ref={containerRef}
      className={styles.canvasContainer}
      style={{ cursor: effectiveCursor }}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <SelectionOverlay
        selectedNodes={selectedRenderNodes}
        worldToScreen={worldToScreen}
        onHandlePointerDown={handleHandlePointerDown}
        marqueeScreen={marqueeScreenRect}
        interactionCursor={interactionCursor}
      />
    </div>
  );
}

// ── Cursor helpers ──

function getResizeCursor(handle: string): string {
  switch (handle) {
    case 'top':
    case 'bottom':
      return 'ns-resize';
    case 'left':
    case 'right':
      return 'ew-resize';
    case 'top-left':
    case 'bottom-right':
      return 'nwse-resize';
    case 'top-right':
    case 'bottom-left':
      return 'nesw-resize';
    default:
      return 'default';
  }
}

/**
 * Lightweight screen-space handle hit testing for hover cursor.
 * Tests corners, edges, and rotation zones.
 */
function hitTestScreenHandles(
  screenCorners: [Vec2, Vec2, Vec2, Vec2],
  screenPoint: Vec2,
): { cursor: string } | null {
  const [tl, tr, br, bl] = screenCorners;
  const CORNER_RADIUS = 12;
  const EDGE_DIST = 8;
  const ROT_OFFSET = 22;
  const ROT_RADIUS = 14;

  const center = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };

  // Check rotation zones first (outside corners)
  const rotCorners = [tl, tr, br, bl].map((c) => {
    const dx = c.x - center.x;
    const dy = c.y - center.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return c;
    const factor = (len + ROT_OFFSET) / len;
    return { x: center.x + dx * factor, y: center.y + dy * factor };
  });

  for (const rc of rotCorners) {
    if (dist(screenPoint, rc) <= ROT_RADIUS) {
      return { cursor: 'grab' };
    }
  }

  // Corner handles
  const corners = [
    { pos: tl, cursor: 'nwse-resize' },
    { pos: tr, cursor: 'nesw-resize' },
    { pos: br, cursor: 'nwse-resize' },
    { pos: bl, cursor: 'nesw-resize' },
  ];
  for (const c of corners) {
    if (dist(screenPoint, c.pos) <= CORNER_RADIUS) {
      return { cursor: c.cursor };
    }
  }

  // Edge proximity
  const edges = [
    { a: tl, b: tr, cursor: 'ns-resize' },
    { a: tr, b: br, cursor: 'ew-resize' },
    { a: br, b: bl, cursor: 'ns-resize' },
    { a: bl, b: tl, cursor: 'ew-resize' },
  ];
  for (const edge of edges) {
    if (distToSegment(screenPoint, edge.a, edge.b) <= EDGE_DIST) {
      return { cursor: edge.cursor };
    }
  }

  return null;
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}
