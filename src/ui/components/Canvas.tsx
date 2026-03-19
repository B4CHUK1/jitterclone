import { useRef, useEffect, useCallback, useState } from 'react';
import { PixiRenderer } from '@/engine/renderer';
import { buildSceneGraph, findRenderNode } from '@/engine/scene';
import { hitTestPoint, hitTestRect } from '@/engine/interaction/hitTest';
import { beginDrag, updateDrag } from '@/engine/interaction/dragInteraction';
import { beginResize, updateResize } from '@/engine/interaction/resizeInteraction';
import { beginRotate, updateRotate } from '@/engine/interaction/rotateInteraction';
import { beginMarquee, updateMarquee, getMarqueeRect } from '@/engine/interaction/marqueeInteraction';
import type { DragState } from '@/engine/interaction/dragInteraction';
import type { ResizeState } from '@/engine/interaction/resizeInteraction';
import type { RotateState } from '@/engine/interaction/rotateInteraction';
import type { MarqueeState } from '@/engine/interaction/marqueeInteraction';
import type { ResizeHandle } from '@/state/editorStore';
import type { RenderNode } from '@/engine/scene';
import type { Vec2 } from '@/engine/transform';
import { useDocumentStore, useEditorStore, useViewportStore } from '@/state';
import { SelectionOverlay } from '@/ui/overlays/SelectionOverlay';
import styles from './Canvas.module.css';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);

  // Interaction state refs (not React state, to avoid re-renders during drag)
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const rotateStateRef = useRef<RotateState | null>(null);
  const marqueeStateRef = useRef<MarqueeState | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<Vec2>({ x: 0, y: 0 });

  // Force re-render for overlay updates
  const [, setRenderTick] = useState(0);
  const tick = useCallback(() => setRenderTick((t) => t + 1), []);

  const document = useDocumentStore((s) => s.document);
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

  // ── Init renderer ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new PixiRenderer();
    rendererRef.current = renderer;

    const rect = container.getBoundingClientRect();
    renderer.init({
      canvas,
      width: rect.width,
      height: rect.height,
      backgroundColor: 0x0d0d12,
    }).then(() => {
      setContainerSize(rect.width, rect.height);
      resetView(document.width, document.height);
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
    renderer.renderDocBackground(document.width, document.height);

    const sceneRoots = buildSceneGraph(document);
    renderer.render(sceneRoots);
  }, [document, panX, panY, zoom]);

  // ── Build scene for interactions ──
  const getScene = useCallback(() => buildSceneGraph(document), [document]);

  const getContainerOffset = useCallback((): Vec2 => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left, y: rect.top } : { x: 0, y: 0 };
  }, []);

  const clientToScreen = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const offset = getContainerOffset();
      return { x: clientX - offset.x, y: clientY - offset.y };
    },
    [getContainerOffset],
  );

  // ── Marquee screen rect for overlay ──
  const [marqueeScreenRect, setMarqueeScreenRect] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);

  // ── Wheel handler ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const screen = clientToScreen(e.clientX, e.clientY);

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const delta = -e.deltaY * 0.003;
        zoomAtPoint(delta, screen);
      } else {
        // Pan
        pan(-e.deltaX, -e.deltaY);
      }
      tick();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [clientToScreen, zoomAtPoint, pan, tick]);

  // ── Pointer handlers ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && (activeTool === 'hand' || e.altKey))) {
        // Pan
        isPanningRef.current = true;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (e.button !== 0) return;

      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);
      const scene = getScene();
      const hit = hitTestPoint(scene, world);

      if (hit) {
        // Hit an element
        if (e.shiftKey) {
          toggleSelect(hit.node.id);
        } else if (!selectedIds.has(hit.node.id)) {
          select(hit.node.id);
        }

        // Start drag
        const currentSelectedIds = e.shiftKey
          ? new Set([...selectedIds, hit.node.id])
          : selectedIds.has(hit.node.id)
            ? selectedIds
            : new Set([hit.node.id]);

        dragStateRef.current = beginDrag(world, currentSelectedIds, (id) => {
          return document.nodes[id]?.transform;
        });

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        // Miss — start marquee or deselect
        if (!e.shiftKey) {
          deselectAll();
        }
        marqueeStateRef.current = beginMarquee(world);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }

      tick();
    },
    [activeTool, clientToScreen, screenToWorld, getScene, selectedIds, select, toggleSelect, deselectAll, document.nodes, tick],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPanPointRef.current.x;
        const dy = e.clientY - lastPanPointRef.current.y;
        pan(dx, dy);
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        tick();
        return;
      }

      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);

      if (dragStateRef.current) {
        const updates = updateDrag(dragStateRef.current, world);
        for (const [id, pos] of updates) {
          updateTransform(id, pos);
        }
        tick();
        return;
      }

      if (resizeStateRef.current) {
        const updates = updateResize(resizeStateRef.current, world, e.shiftKey);
        updateTransform(resizeStateRef.current.nodeId, updates);
        tick();
        return;
      }

      if (rotateStateRef.current) {
        const updates = updateRotate(rotateStateRef.current, world, e.shiftKey);
        updateTransform(rotateStateRef.current.nodeId, updates);
        tick();
        return;
      }

      if (marqueeStateRef.current) {
        marqueeStateRef.current = updateMarquee(marqueeStateRef.current, world);
        const rect = getMarqueeRect(marqueeStateRef.current);

        // Convert to screen for display
        const screenMin = worldToScreen({ x: rect.x, y: rect.y });
        const screenMax = worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height });
        setMarqueeScreenRect({
          x: Math.min(screenMin.x, screenMax.x),
          y: Math.min(screenMin.y, screenMax.y),
          width: Math.abs(screenMax.x - screenMin.x),
          height: Math.abs(screenMax.y - screenMin.y),
        });

        // Live selection
        const scene = getScene();
        const hits = hitTestRect(scene, rect);
        selectMultiple(hits.map((h) => h.node.id));
        tick();
        return;
      }
    },
    [clientToScreen, screenToWorld, worldToScreen, pan, updateTransform, getScene, selectMultiple, tick],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      isPanningRef.current = false;
      dragStateRef.current = null;
      resizeStateRef.current = null;
      rotateStateRef.current = null;
      marqueeStateRef.current = null;
      setMarqueeScreenRect(null);
      tick();
    },
    [tick],
  );

  // ── Handle pointer down on selection handles ──
  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, handle: string) => {
      e.stopPropagation();
      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);

      const nodeId = [...selectedIds][0];
      if (!nodeId) return;
      const node = document.nodes[nodeId];
      if (!node) return;

      if (handle.startsWith('rotate-')) {
        rotateStateRef.current = beginRotate(world, nodeId, node.transform);
      } else {
        resizeStateRef.current = beginResize(
          handle as ResizeHandle,
          world,
          nodeId,
          node.transform,
        );
      }

      // Capture on the container for move/up events
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [clientToScreen, screenToWorld, selectedIds, document.nodes],
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

  return (
    <div ref={containerRef} className={styles.canvasContainer}>
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
      />
    </div>
  );
}
