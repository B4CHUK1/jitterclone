import { useRef, useEffect, useCallback, useState } from 'react';
import { PixiRenderer } from '@/engine/renderer';
import { buildSceneGraph, findRenderNode } from '@/engine/scene';
import { hitTestHandles, hitTestPoint, hitTestRect } from '@/engine/interaction/hitTest';
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
import { getResizeCursorFromDirection } from '@/engine/interaction/resizeCursor';
import {
  getCanvasBounds,
  getRenderNodeBounds,
  offsetBounds,
  resolveBoundsSnapping,
  type SnapGuide,
  type WorldBounds,
} from '@/engine/interaction/snapEngine';
import { resolveResizeSnap } from '@/engine/interaction/resizeSnap';
import { useDocumentStore, useEditorStore, useViewportStore } from '@/state';
import { useTimelineStore } from '@/state';
import { evaluateDocumentAtTime } from '@/engine/animation';
import { SelectionOverlay } from '@/ui/overlays/SelectionOverlay';
import { SnapOverlay } from '@/ui/overlays/SnapOverlay';
import { RotateTooltipOverlay } from '@/ui/overlays/RotateTooltipOverlay';
import { defaultTransform } from '@/engine/transform/transform';
import { ROTATE_CURSOR } from '@/ui/cursors';
import styles from './Canvas.module.css';
import { normalizePenPath, type PenPoint } from './penPathUtils';

// ── Drag threshold to distinguish click from drag ──
const DRAG_THRESHOLD = 3; // pixels
const SNAP_THRESHOLD_SCREEN_PX = 8;

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
  const dragStartBoundsRef = useRef<WorldBounds | null>(null);
  const resizeStaticBoundsRef = useRef<WorldBounds[]>([]);

  // ── Cursor state ──
  const [interactionCursor, setInteractionCursor] = useState<string | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [rotateTooltip, setRotateTooltip] = useState<{
    client: Vec2;
    angle: number;
    snapped: boolean;
  } | null>(null);

  // Force re-render for overlay updates
  const [, setRenderTick] = useState(0);
  const tick = useCallback(() => setRenderTick((t) => t + 1), []);

  const penPointsRef = useRef<PenPoint[]>([]);
  const penActiveRef = useRef(false);
  const penDraggingHandleRef = useRef(false);
  const penClosedRef = useRef(false);
  const [penPreview, setPenPreview] = useState<{
    points: PenPoint[];
    cursor: { x: number; y: number } | null;
    draggingHandle: boolean;
  } | null>(null);

  const doc = useDocumentStore((s) => s.document);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const evaluatedDoc = evaluateDocumentAtTime(doc, currentTime);
  const updateTransform = useDocumentStore((s) => s.updateTransform);
  const setAnimatableValue = useDocumentStore((s) => s.setAnimatableValue);
  const addNode = useDocumentStore((s) => s.addNode);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const selectMultiple = useEditorStore((s) => s.selectMultiple);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const deselectAll = useEditorStore((s) => s.deselectAll);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const autoKeyframe = useTimelineStore((s) => s.autoKeyframe);

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
  const getScene = useCallback(() => buildSceneGraph(evaluatedDoc), [evaluatedDoc]);

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
      setSnapGuides([]);
      setRotateTooltip(null);
      dragStartBoundsRef.current = null;
      resizeStaticBoundsRef.current = [];

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
        resetView(doc.composition.width, doc.composition.height);
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
    renderer.renderDocBackground(
      doc.composition.width,
      doc.composition.height,
      doc.composition.background,
    );

    const sceneRoots = buildSceneGraph(evaluatedDoc);
    renderer.render(sceneRoots);
  }, [doc.composition.width, doc.composition.height, doc.composition.background, evaluatedDoc, panX, panY, zoom]);

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

          const handleHit = hitTestHandles(screenCorners, screen);
          if (handleHit) {
            setHoverCursor(handleHit.type.startsWith('rotate-') ? ROTATE_CURSOR : handleHit.cursor);
            return;
          }
        }
      }

      // Check if hovering over an element body
      const world = screenToWorld(screen);
      const scene = getScene();
      const hit = hitTestPoint(scene, world);
      if (hit) {
        setHoverCursor(selectedIds.has(hit.node.id) ? 'grab' : 'default');
      } else {
        setHoverCursor('default');
      }
    },
    [clientToScreen, selectedIds, getScene, worldToScreen, screenToWorld],
  );

  // ── Finalize pen path: create node from accumulated anchor points ──
  const finalizePenPath = useCallback((closed: boolean = false) => {
    const points = penPointsRef.current;
    const isClosed = closed || penClosedRef.current;
    penActiveRef.current = false;
    penPointsRef.current = [];
    penDraggingHandleRef.current = false;
    penClosedRef.current = false;
    setPenPreview(null);
    setInteractionCursor(null);

    if (points.length >= 2) {
      const normalizedPath = normalizePenPath(points, isClosed);
      const id = addNode('path', {
        transform: {
          ...defaultTransform(),
          ...normalizedPath.transform,
        },
        pathData: normalizedPath.pathData,
        pathClosed: normalizedPath.pathClosed,
        style: {
          fill: { color: '#5B8DEF', opacity: isClosed ? 1 : 0 },
          stroke: { color: '#5B8DEF', width: 2, opacity: 1 },
          opacity: 1,
          cornerRadius: 0,
          effects: [],
          blendMode: 'normal' as const,
        },
      } as Partial<import('@/document/types').SceneNode>);
      select(id);
    }
    setTool('select');
  }, [addNode, select, setTool]);

  // ── Pen tool keyboard: Enter/Escape = finalize open path ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && penActiveRef.current) {
        e.preventDefault();
        finalizePenPath(false);
      }
      if (e.key === 'Enter' && penActiveRef.current) {
        e.preventDefault();
        finalizePenPath(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finalizePenPath]);

  // ── Cancel pen path when switching tools ──
  useEffect(() => {
    if (activeTool !== 'pen' && penActiveRef.current) {
      penActiveRef.current = false;
      penPointsRef.current = [];
      penDraggingHandleRef.current = false;
      penClosedRef.current = false;
      setPenPreview(null);
    }
  }, [activeTool]);

  const startHandleInteraction = useCallback(
    (e: React.PointerEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();

      const screen = clientToScreen(e.clientX, e.clientY);
      const world = screenToWorld(screen);

      const nodeId = [...selectedIds][0];
      if (!nodeId) return;
      const node = evaluatedDoc.nodes[nodeId];
      if (!node) return;
      const scene = getScene();
      const renderNode = findRenderNode(scene, nodeId);

      pointerIdRef.current = e.pointerId;
      containerRef.current?.setPointerCapture(e.pointerId);

      if (handle.startsWith('rotate-')) {
        const rotateTargets = [...selectedIds]
          .map((id) => {
            const targetNode = evaluatedDoc.nodes[id];
            const targetRenderNode = findRenderNode(scene, id);
            if (!targetNode || !targetRenderNode) return null;
            return {
              nodeId: id,
              transform: targetNode.transform,
              worldMatrix: targetRenderNode.worldMatrix,
            };
          })
          .filter((target): target is NonNullable<typeof target> => target !== null);

        if (rotateTargets.length === 0) return;
        rotateStateRef.current = beginRotate(world, rotateTargets);
        phaseRef.current = 'rotating';
        setInteractionCursor(ROTATE_CURSOR);
        setRotateTooltip({
          client: { x: e.clientX, y: e.clientY },
          angle: node.transform.rotation,
          snapped: false,
        });
      } else {
        const handleCursor = renderNode
          ? getResizeCursorForHandle(
              handle,
              getWorldCorners(renderNode.node.transform, renderNode.worldMatrix).map(worldToScreen) as [
                Vec2,
                Vec2,
                Vec2,
                Vec2,
              ],
            )
          : getResizeCursor(handle);
        resizeStateRef.current = beginResize(
          handle as ResizeHandle,
          world,
          nodeId,
          node.transform,
        );
        phaseRef.current = 'resizing';
        const staticBounds = getStaticBounds(scene, new Set([nodeId]));
        resizeStaticBoundsRef.current = staticBounds;
        setInteractionCursor(handleCursor);
      }
    },
    [clientToScreen, screenToWorld, selectedIds, evaluatedDoc.nodes, getScene, worldToScreen],
  );

  // ── POINTER DOWN on canvas ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Pen tool: click-to-place anchor points, drag-to-create Bézier handles
      if (e.button === 0 && activeTool === 'pen') {
        e.preventDefault();
        const screen = clientToScreen(e.clientX, e.clientY);
        const world = screenToWorld(screen);

        // Click near first anchor point: close and finalize path
        if (penActiveRef.current && penPointsRef.current.length >= 3) {
          const firstPt = penPointsRef.current[0]!;
          const firstScreen = worldToScreen(firstPt);
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            const scrX = e.clientX - containerRect.left;
            const scrY = e.clientY - containerRect.top;
            if (Math.sqrt((scrX - firstScreen.x) ** 2 + (scrY - firstScreen.y) ** 2) < 10) {
              penClosedRef.current = true;
              finalizePenPath(true);
              return;
            }
          }
        }

        penActiveRef.current = true;
        // Add new point with no handles (corner point)
        const newPoint = { x: world.x, y: world.y, handleInX: 0, handleInY: 0, handleOutX: 0, handleOutY: 0 };
        penPointsRef.current = [...penPointsRef.current, newPoint];
        penDraggingHandleRef.current = true;

        // Track drag for handle creation
        const startClient = { x: e.clientX, y: e.clientY };
        const pointIndex = penPointsRef.current.length - 1;

        const onMove = (ev: globalThis.PointerEvent) => {
          const moveScreen = clientToScreen(ev.clientX, ev.clientY);
          const moveWorld = screenToWorld(moveScreen);
          const dx = moveWorld.x - world.x;
          const dy = moveWorld.y - world.y;
          // If dragged beyond threshold, create symmetric handles
          const dist = Math.sqrt((ev.clientX - startClient.x) ** 2 + (ev.clientY - startClient.y) ** 2);
          if (dist > 3) {
            const pts = [...penPointsRef.current];
            pts[pointIndex] = {
              ...pts[pointIndex]!,
              handleOutX: dx,
              handleOutY: dy,
              handleInX: -dx,
              handleInY: -dy,
            };
            penPointsRef.current = pts;
            setPenPreview({ points: [...pts], cursor: moveWorld, draggingHandle: true });
          }
        };

        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          penDraggingHandleRef.current = false;
          setPenPreview({ points: [...penPointsRef.current], cursor: world, draggingHandle: false });
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);

        setPenPreview({ points: [...penPointsRef.current], cursor: world, draggingHandle: false });
        setInteractionCursor('crosshair');
        return;
      }

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
      const firstSelectedId = [...selectedIds][0];
      if (firstSelectedId) {
        const selectedNode = findRenderNode(scene, firstSelectedId);
        if (selectedNode) {
          const handleHit = hitTestHandles(
            getWorldCorners(selectedNode.node.transform, selectedNode.worldMatrix).map(worldToScreen) as [
              Vec2,
              Vec2,
              Vec2,
              Vec2,
            ],
            screen,
          );

          if (handleHit) {
            startHandleInteraction(e, handleHit.type);
            return;
          }
        }
      }
      const hit = hitTestPoint(scene, world);

      startClientRef.current = { x: e.clientX, y: e.clientY };
      pointerIdRef.current = e.pointerId;
      containerRef.current?.setPointerCapture(e.pointerId);

      if (hit) {
        pendingHitIdRef.current = hit.node.id;
        pendingShiftRef.current = e.shiftKey;
        phaseRef.current = 'pending-drag';
      } else {
        if (!e.shiftKey) {
          deselectAll();
        }
        pendingShiftRef.current = e.shiftKey;
        phaseRef.current = 'pending-marquee';
      }

      tick();
    },
    [activeTool, clientToScreen, screenToWorld, getScene, deselectAll, tick, selectedIds, worldToScreen, startHandleInteraction, finalizePenPath],
  );

  // ── POINTER MOVE ──
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Pen tool: update cursor preview position (but not during handle drag — that's handled separately)
      if (activeTool === 'pen') {
        if (penDraggingHandleRef.current) return;
        const screen = clientToScreen(e.clientX, e.clientY);
        const world = screenToWorld(screen);
        if (penActiveRef.current) {
          setPenPreview((prev) =>
            prev
              ? { ...prev, cursor: world }
              : { points: penPointsRef.current, cursor: world, draggingHandle: false },
          );
        }
        return;
      }

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
            const currentScene = getScene();
            const selectedBounds = [...currentSelected]
              .map((id) => {
                const rn = findRenderNode(currentScene, id);
                return rn ? getRenderNodeBounds(rn) : null;
              })
              .filter((bounds): bounds is WorldBounds => bounds !== null);
            dragStartBoundsRef.current = selectedBounds.length > 0 ? mergeBounds(selectedBounds) : null;
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
        const threshold = SNAP_THRESHOLD_SCREEN_PX / zoom;
        const scene = getScene();
        const staticBounds = getStaticBounds(scene, selectedIds);
        const firstUpdate = updates.values().next().value as { x: number; y: number } | undefined;

        if (dragStartBoundsRef.current && firstUpdate && dragStateRef.current.startTransforms.size > 0) {
          const firstStart = dragStateRef.current.startTransforms.values().next().value;
          if (firstStart) {
            let proposedDx = firstUpdate.x - firstStart.x;
            let proposedDy = firstUpdate.y - firstStart.y;
            if (e.shiftKey) {
              if (Math.abs(proposedDx) >= Math.abs(proposedDy)) proposedDy = 0;
              else proposedDx = 0;
            }
            const movingBounds = offsetBounds(dragStartBoundsRef.current, proposedDx, proposedDy);
            const snap = resolveBoundsSnapping(
              movingBounds,
              staticBounds,
              getCanvasBounds(doc.composition.width, doc.composition.height),
              threshold,
            );
            for (const [id, pos] of updates) {
              const x = e.shiftKey && Math.abs(proposedDx) < Math.abs(proposedDy) ? dragStateRef.current.startTransforms.get(id)?.x ?? pos.x : pos.x;
              const y = e.shiftKey && Math.abs(proposedDx) >= Math.abs(proposedDy) ? dragStateRef.current.startTransforms.get(id)?.y ?? pos.y : pos.y;
              setAnimatableValue(id, 'x', x + snap.dx, currentTime, autoKeyframe);
              setAnimatableValue(id, 'y', y + snap.dy, currentTime, autoKeyframe);
            }
            setSnapGuides(snap.guides);
            tick();
            return;
          }
        }

        for (const [id, pos] of updates) {
          setAnimatableValue(id, 'x', pos.x, currentTime, autoKeyframe);
          setAnimatableValue(id, 'y', pos.y, currentTime, autoKeyframe);
        }
        setSnapGuides([]);
        tick();
        return;
      }

      if (phaseRef.current === 'resizing' && resizeStateRef.current) {
        const mods: ResizeModifiers = { shift: e.shiftKey, alt: e.altKey };
        const updates = updateResize(resizeStateRef.current, world, mods);
        const snapped = resolveResizeSnap(
          resizeStateRef.current,
          world,
          mods,
          updates,
          resizeStaticBoundsRef.current,
          getCanvasBounds(doc.composition.width, doc.composition.height),
          SNAP_THRESHOLD_SCREEN_PX / zoom,
        );
        const resizeTransform = snapped.transform;
        if (resizeTransform.x !== undefined) {
          setAnimatableValue(resizeStateRef.current.nodeId, 'x', resizeTransform.x, currentTime, autoKeyframe);
        }
        if (resizeTransform.y !== undefined) {
          setAnimatableValue(resizeStateRef.current.nodeId, 'y', resizeTransform.y, currentTime, autoKeyframe);
        }
        updateTransform(resizeStateRef.current.nodeId, {
          width: resizeTransform.width,
          height: resizeTransform.height,
        });
        setSnapGuides(snapped.guides);
        tick();
        return;
      }

      if (phaseRef.current === 'rotating' && rotateStateRef.current) {
        const updates = updateRotate(rotateStateRef.current, world, e.shiftKey);
        for (const [id, transform] of updates.updates) {
          if (transform.rotation !== undefined) {
            setAnimatableValue(id, 'rotation', transform.rotation, currentTime, autoKeyframe);
          }
          updateTransform(id, { x: transform.x, y: transform.y });
        }
        setRotateTooltip({
          client: { x: e.clientX, y: e.clientY },
          angle: updates.primaryRotation,
          snapped: e.shiftKey,
        });
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
      setAnimatableValue,
      doc.composition.width,
      doc.composition.height,
      zoom,
      getScene,
      selectMultiple,
      tick,
      currentTime,
      autoKeyframe,
    ],
  );

  // ── POINTER UP ──
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Pen tool is click-based — nothing to do on pointer up
      if (activeTool === 'pen') {
        return;
      }

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
    [activeTool, select, toggleSelect, resetInteraction],
  );

  // ── Pointer cancel / window blur — safety cleanup ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cleanup = () => {
      if (phaseRef.current !== 'idle') {
        resetInteraction(pointerIdRef.current ?? undefined);
      }
    };

    // pointercancel: browser cancelled the gesture (e.g. touch interrupted)
    container.addEventListener('pointercancel', cleanup);
    // blur: user switched windows/tabs during an interaction
    window.addEventListener('blur', cleanup);

    return () => {
      container.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('blur', cleanup);
    };
  }, [resetInteraction]);

  // ── Handle pointer down on selection handles (from overlay) ──
  const handleHandlePointerDown = startHandleInteraction;

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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
      />
      <SelectionOverlay
        selectedNodes={selectedRenderNodes}
        worldToScreen={worldToScreen}
        onHandlePointerDown={handleHandlePointerDown}
        marqueeScreen={marqueeScreenRect}
      />
      <SnapOverlay
        guides={snapGuides}
        worldToScreen={worldToScreen}
      />
      <RotateTooltipOverlay tooltip={rotateTooltip} />

      {/* ── Pen tool preview overlay ── */}
      {activeTool === 'pen' && penPreview && (
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
          {/* Committed path segments (Bézier or line) */}
          {penPreview.points.length > 1 && (
            <path
              d={(() => {
                const pts = penPreview.points;
                const s0 = worldToScreen(pts[0]!);
                let d = `M ${s0.x} ${s0.y}`;
                for (let i = 1; i < pts.length; i++) {
                  const prev = pts[i - 1]!;
                  const curr = pts[i]!;
                  const hasHandles =
                    (prev.handleOutX !== 0 || prev.handleOutY !== 0) ||
                    (curr.handleInX !== 0 || curr.handleInY !== 0);
                  if (hasHandles) {
                    const cp1 = worldToScreen({ x: prev.x + prev.handleOutX, y: prev.y + prev.handleOutY });
                    const cp2 = worldToScreen({ x: curr.x + curr.handleInX, y: curr.y + curr.handleInY });
                    const end = worldToScreen(curr);
                    d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
                  } else {
                    const end = worldToScreen(curr);
                    d += ` L ${end.x} ${end.y}`;
                  }
                }
                return d;
              })()}
              fill="none"
              stroke="#4dabf7"
              strokeWidth="1.5"
            />
          )}
          {/* Live preview: dashed segment from last point to cursor */}
          {penPreview.points.length > 0 && penPreview.cursor && !penPreview.draggingHandle && (() => {
            const last = penPreview.points[penPreview.points.length - 1]!;
            // If last point has an outgoing handle, show a cubic bezier preview
            const hasHandle = last.handleOutX !== 0 || last.handleOutY !== 0;
            const lastSc = worldToScreen(last);
            const curSc = worldToScreen(penPreview.cursor);
            if (hasHandle) {
              const cp1 = worldToScreen({ x: last.x + last.handleOutX, y: last.y + last.handleOutY });
              return (
                <path
                  d={`M ${lastSc.x} ${lastSc.y} C ${cp1.x} ${cp1.y}, ${curSc.x} ${curSc.y}, ${curSc.x} ${curSc.y}`}
                  fill="none"
                  stroke="#4dabf7"
                  strokeWidth="1"
                  strokeDasharray="5 3"
                  opacity="0.65"
                />
              );
            }
            return (
              <line
                x1={lastSc.x}
                y1={lastSc.y}
                x2={curSc.x}
                y2={curSc.y}
                stroke="#4dabf7"
                strokeWidth="1"
                strokeDasharray="5 3"
                opacity="0.65"
              />
            );
          })()}
          {/* Bézier handle lines and circles */}
          {penPreview.points.map((p, i) => {
            const s = worldToScreen(p);
            const elements: React.ReactNode[] = [];
            // Show outgoing handle
            if (p.handleOutX !== 0 || p.handleOutY !== 0) {
              const hOut = worldToScreen({ x: p.x + p.handleOutX, y: p.y + p.handleOutY });
              elements.push(
                <line key={`hout-line-${i}`} x1={s.x} y1={s.y} x2={hOut.x} y2={hOut.y} stroke="#ff6b6b" strokeWidth="1" opacity="0.7" />,
                <circle key={`hout-${i}`} cx={hOut.x} cy={hOut.y} r={3.5} fill="#ff6b6b" stroke="#fff" strokeWidth="0.8" />,
              );
            }
            // Show incoming handle
            if (p.handleInX !== 0 || p.handleInY !== 0) {
              const hIn = worldToScreen({ x: p.x + p.handleInX, y: p.y + p.handleInY });
              elements.push(
                <line key={`hin-line-${i}`} x1={s.x} y1={s.y} x2={hIn.x} y2={hIn.y} stroke="#ff6b6b" strokeWidth="1" opacity="0.7" />,
                <circle key={`hin-${i}`} cx={hIn.x} cy={hIn.y} r={3.5} fill="#ff6b6b" stroke="#fff" strokeWidth="0.8" />,
              );
            }
            return <g key={`handles-${i}`}>{elements}</g>;
          })}
          {/* Anchor point squares */}
          {penPreview.points.map((p, i) => {
            const s = worldToScreen(p);
            const isFirst = i === 0 && penPreview.points.length >= 3;
            return (
              <rect
                key={`anchor-${i}`}
                x={s.x - 4}
                y={s.y - 4}
                width={8}
                height={8}
                fill={isFirst ? '#69db7c' : '#ffffff'}
                stroke={isFirst ? '#2f9e44' : '#4dabf7'}
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

function getStaticBounds(scene: RenderNode[], excludedIds: ReadonlySet<string>): WorldBounds[] {
  const stack = [...scene];
  const bounds: WorldBounds[] = [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    stack.push(...node.children);
    if (excludedIds.has(node.node.id)) continue;
    bounds.push(getRenderNodeBounds(node));
  }
  return bounds;
}

function mergeBounds(boundsList: WorldBounds[]): WorldBounds {
  const left = Math.min(...boundsList.map((b) => b.left));
  const right = Math.max(...boundsList.map((b) => b.right));
  const top = Math.min(...boundsList.map((b) => b.top));
  const bottom = Math.max(...boundsList.map((b) => b.bottom));
  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
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

function getResizeCursorForHandle(
  handle: string,
  screenCorners: [Vec2, Vec2, Vec2, Vec2],
): string {
  const [tl, tr, br, bl] = screenCorners;
  const center = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };
  const pointByHandle: Record<string, Vec2> = {
    top: midpoint(tl, tr),
    right: midpoint(tr, br),
    bottom: midpoint(br, bl),
    left: midpoint(bl, tl),
    'top-left': tl,
    'top-right': tr,
    'bottom-right': br,
    'bottom-left': bl,
  };
  const p = pointByHandle[handle];
  if (!p) return getResizeCursor(handle);
  return getResizeCursorFromDirection({ x: p.x - center.x, y: p.y - center.y });
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
