import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import type { AnimatableProperty, EasingPreset, SceneNode } from '@/document/types';
import {
  SkipBack,
  ChevronLeft,
  Play,
  Pause,
  Square as StopIcon,
  ChevronRight,
  SkipForward,
  KeyRound,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Diamond,
} from '@/ui/components/icons';
import {
  hasKeyframeAtTime,
  globalToLocalTime,
  localToGlobalTime,
  clampKeyframeTime,
  getClipDuration,
} from '@/engine/animation';
import { useDocumentStore, useEditorStore, useTimelineStore } from '@/state';
import {
  buildTimelineLayout,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_RULER_HEIGHT,
  TIMELINE_ROW_GAP,
} from './timelineLayout';
import { createTimelineTimeScale } from './timelineMapping';
import styles from './TimelinePanel.module.css';

const PROPERTIES: { key: AnimatableProperty; label: string }[] = [
  { key: 'x', label: 'Position X' },
  { key: 'y', label: 'Position Y' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'scaleX', label: 'Scale X' },
  { key: 'scaleY', label: 'Scale Y' },
  { key: 'opacity', label: 'Opacity' },
];

const END_EPSILON_SECONDS = 1e-4;
const SNAP_PX = 8;

export function TimelinePanel() {
  const document = useDocumentStore((s) => s.document);
  const moveKeyframes = useDocumentStore((s) => s.moveKeyframes);
  const removeKeyframe = useDocumentStore((s) => s.removeKeyframe);
  const setKeyframe = useDocumentStore((s) => s.setKeyframe);
  const setKeyframeEasing = useDocumentStore((s) => s.setKeyframeEasing);
  const updateTiming = useDocumentStore((s) => s.updateTiming);
  const updateComposition = useDocumentStore((s) => s.updateComposition);
  const reorderLayers = useDocumentStore((s) => s.reorderLayers);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const autoKeyframe = useTimelineStore((s) => s.autoKeyframe);
  const toggleAutoKeyframe = useTimelineStore((s) => s.toggleAutoKeyframe);
  const timeScaleValue = useTimelineStore((s) => s.timeScale);
  const setTimeScale = useTimelineStore((s) => s.setTimeScale);
  const setScrollX = useTimelineStore((s) => s.setScrollX);
  const selectedKeyframes = useTimelineStore((s) => s.selectedKeyframes);
  const setSelectedKeyframes = useTimelineStore((s) => s.setSelectedKeyframes);
  const toggleKeyframeSelection = useTimelineStore((s) => s.toggleKeyframeSelection);

  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const addKeyframeAtCurrentTime = useDocumentStore((s) => s.addKeyframeAtCurrentTime);

  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [clipboardKeys, setClipboardKeys] = useState<{ nodeId: string; property: AnimatableProperty; time: number; value: number }[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const resumePlaybackRef = useRef(false);

  // Box select state
  const [boxSelectRect, setBoxSelectRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const boxSelectActiveRef = useRef(false);

  const toTimelineSpace = useCallback((clientX: number, clientY: number) => {
    if (!viewportRef.current) return { x: 0, y: 0 };
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left + viewportRef.current.scrollLeft,
      y: clientY - rect.top + viewportRef.current.scrollTop,
    };
  }, []);

  // Snap line state
  const [activeSnapTime, setActiveSnapTime] = useState<number | null>(null);

  // Layer drag-reorder state
  const [layerDragState, setLayerDragState] = useState<{
    draggedId: string;
    dropIndex: number;
    startY: number;
  } | null>(null);

  const getNode = useCallback((nodeId: string) => document.nodes[nodeId], [document.nodes]);

  const { duration, fps, workAreaStart, workAreaEnd } = document.composition;
  const frame = Math.round(currentTime * fps);
  const frameStep = 1 / Math.max(1, fps);

  const tracks = useMemo(
    () =>
      document.rootNodeIds
        .map((id) => document.nodes[id])
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    [document],
  );

  const timeScale = useMemo(() => createTimelineTimeScale(duration, timeScaleValue), [duration, timeScaleValue]);
  const layout = useMemo(
    () => buildTimelineLayout(tracks, expandedLayers, PROPERTIES),
    [tracks, expandedLayers],
  );

  const totalWidth = TIMELINE_LABEL_WIDTH + timeScale.contentWidth;
  const playheadX = TIMELINE_LABEL_WIDTH + timeScale.toX(currentTime);

  // ── Snap system ──
  const allSnapTimes = useMemo(() => {
    const times: number[] = [];
    for (const node of tracks) {
      times.push(node.startTime, node.endTime);
      for (const property of PROPERTIES) {
        for (const key of node.animation.properties[property.key].keyframes) {
          times.push(localToGlobalTime(key.time, node));
        }
      }
    }
    return times;
  }, [tracks]);

  const getSnapTime = useCallback(
    (time: number, lockSnap: boolean, disableSnap: boolean): { time: number; snapped: number | null } => {
      if (disableSnap) return { time: timeScale.clampTime(time), snapped: null };
      // Priority: playhead > keyframes > clips > grid
      const candidates = [currentTime, ...allSnapTimes];
      const frameTime = 1 / Math.max(1, fps);
      candidates.push(Math.round(time / frameTime) * frameTime);
      let snapped = time;
      let snappedTo: number | null = null;
      let minDistance = lockSnap ? Infinity : SNAP_PX / timeScale.pixelsPerSecond;
      for (const candidate of candidates) {
        const d = Math.abs(candidate - time);
        if (d < minDistance) {
          minDistance = d;
          snapped = candidate;
          snappedTo = candidate;
        }
      }
      return { time: timeScale.clampTime(snapped), snapped: snappedTo };
    },
    [currentTime, allSnapTimes, fps, timeScale],
  );

  const updateTimeFromClientX = (clientX: number, lockSnap = false, disableSnap = false) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const pixelInSpace = clientX - rect.left + viewportRef.current.scrollLeft;
    const pixelInTimeline = pixelInSpace - TIMELINE_LABEL_WIDTH;
    const rawTime = Math.max(0, pixelInTimeline) / timeScale.pixelsPerSecond;
    const { time } = getSnapTime(rawTime, lockSnap, disableSnap);
    setCurrentTime(time);
  };

  // ── Playhead scrub ──
  const beginScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!(event.target instanceof Element)) return;
    // Don't scrub when clicking on interactive elements
    if (event.target.closest('[data-keyframe-button]')) return;
    if (event.target.closest('[data-clip-bar]')) return;
    if (event.target.closest('[data-layer-label]')) return;
    if (event.target.closest('button')) return;

    // Clicks in property time cells start box selection, not scrubbing
    if (event.target.closest('[data-property-time-cell]')) {
      event.preventDefault();
      const pos = toTimelineSpace(event.clientX, event.clientY);
      boxSelectActiveRef.current = true;
      setBoxSelectRect({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
      if (!event.shiftKey) {
        setSelectedKeyframes([]);
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    event.preventDefault();
    resumePlaybackRef.current = isPlaying;
    if (isPlaying) pause();

    setDraggingPlayhead(true);
    updateTimeFromClientX(event.clientX, event.shiftKey, event.altKey);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onScrubMove = (event: PointerEvent<HTMLDivElement>) => {
    if (boxSelectActiveRef.current) {
      event.preventDefault();
      const pos = toTimelineSpace(event.clientX, event.clientY);
      const newRect = { ...(boxSelectRect ?? { x1: pos.x, y1: pos.y }), x2: pos.x, y2: pos.y } as typeof boxSelectRect & NonNullable<typeof boxSelectRect>;
      setBoxSelectRect(newRect);

      const minX = Math.min(newRect.x1, newRect.x2);
      const maxX = Math.max(newRect.x1, newRect.x2);
      const minY = Math.min(newRect.y1, newRect.y2);
      const maxY = Math.max(newRect.y1, newRect.y2);
      const minTime = Math.max(0, timeScale.toTime(minX - TIMELINE_LABEL_WIDTH));
      const maxTime = timeScale.toTime(maxX - TIMELINE_LABEL_WIDTH);

      const newSelected: typeof selectedKeyframes = [];
      for (const row of layout.rows) {
        if (row.kind !== 'property') continue;
        const rowMidY = row.top + row.height / 2;
        if (rowMidY < minY || rowMidY > maxY) continue;
        for (const key of row.node.animation.properties[row.property].keyframes) {
          const globalTime = localToGlobalTime(key.time, row.node);
          if (globalTime >= minTime && globalTime <= maxTime) {
            newSelected.push({ nodeId: row.node.id, property: row.property, time: key.time });
          }
        }
      }

      if (event.shiftKey) {
        const merged = [...selectedKeyframes];
        for (const sel of newSelected) {
          if (!merged.some((s) => s.nodeId === sel.nodeId && s.property === sel.property && Math.abs(s.time - sel.time) < 1e-6)) {
            merged.push(sel);
          }
        }
        setSelectedKeyframes(merged);
      } else {
        setSelectedKeyframes(newSelected);
      }
      return;
    }

    if (!draggingPlayhead) return;
    event.preventDefault();
    updateTimeFromClientX(event.clientX, event.shiftKey, event.altKey);
  };

  const endScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (boxSelectActiveRef.current) {
      boxSelectActiveRef.current = false;
      setBoxSelectRect(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (!draggingPlayhead) return;
    setDraggingPlayhead(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (resumePlaybackRef.current) {
      play();
      resumePlaybackRef.current = false;
    }
  };

  // ── Media controls ──
  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
      return;
    }
    if (duration > 0 && currentTime >= duration - END_EPSILON_SECONDS) {
      setCurrentTime(0);
    }
    play();
  };

  const handleStop = () => {
    pause();
    setCurrentTime(0);
  };

  const stepFrame = (direction: -1 | 1) => {
    pause();
    setCurrentTime(timeScale.clampTime(currentTime + direction * frameStep));
  };

  const jumpToStart = () => {
    pause();
    setCurrentTime(0);
  };

  const jumpToEnd = () => {
    pause();
    setCurrentTime(duration);
  };

  // ── Copy/paste keyframes ──
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        const copied = selectedKeyframes
          .map((sel) => {
            const node = document.nodes[sel.nodeId];
            const key = node?.animation.properties[sel.property].keyframes.find(
              (entry) => Math.abs(entry.time - sel.time) < 1e-6,
            );
            if (!key) return null;
            return { ...sel, value: key.value };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        setClipboardKeys(copied);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboardKeys.length > 0) {
        const minTime = Math.min(...clipboardKeys.map((key) => key.time));
        for (const key of clipboardKeys) {
          const node = document.nodes[key.nodeId];
          if (!node) continue;
          const localBase = globalToLocalTime(currentTime, node);
          const localTime = localBase + (key.time - minTime);
          setKeyframe(key.nodeId, key.property, localTime, key.value);
        }
      }
      // Note: Delete/Backspace is handled globally in App.tsx
      // to avoid conflict between keyframe deletion and object deletion
      // Work area shortcuts: B = set start, N = set end
      if (event.key.toLowerCase() === 'b' && !event.ctrlKey && !event.metaKey) {
        if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
          updateComposition({ workAreaStart: Math.min(currentTime, workAreaEnd - 0.01) });
        }
      }
      if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey) {
        if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
          updateComposition({ workAreaEnd: Math.max(currentTime, workAreaStart + 0.01) });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clipboardKeys, currentTime, document.nodes, selectedKeyframes, setKeyframe, removeKeyframe, setSelectedKeyframes, updateComposition, workAreaStart, workAreaEnd, setKeyframeEasing]);

  // ── Ruler ticks ──
  const rulerTicks = useMemo(() => {
    const pps = timeScale.pixelsPerSecond;
    const majorStep = pps > 320 ? 0.1 : pps > 180 ? 0.25 : pps > 80 ? 0.5 : 1;
    const ticks: { time: number; label?: string }[] = [];
    for (let t = 0; t <= duration + 1e-6; t += majorStep) {
      const major = Math.abs((t / majorStep) % 2) < 1e-6;
      ticks.push({ time: t, label: major ? `${t.toFixed(majorStep < 1 ? 2 : 0)}s` : undefined });
    }
    return ticks;
  }, [duration, timeScale.pixelsPerSecond]);

  // ── Wheel zoom ──
  const onWheelTimeline = (event: WheelEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const rect = viewportRef.current.getBoundingClientRect();
      const pointerX = event.clientX - rect.left + viewportRef.current.scrollLeft - TIMELINE_LABEL_WIDTH;
      const pointerTime = timeScale.toTime(pointerX);
      const delta = -event.deltaY * 0.002;
      const nextScale = Math.max(0.25, Math.min(8, timeScaleValue * (1 + delta)));
      setTimeScale(nextScale);
      requestAnimationFrame(() => {
        if (!viewportRef.current) return;
        const nextTS = createTimelineTimeScale(duration, nextScale);
        viewportRef.current.scrollLeft = Math.max(
          0,
          TIMELINE_LABEL_WIDTH + nextTS.toX(pointerTime) - (event.clientX - rect.left),
        );
      });
      return;
    }
    setScrollX(event.currentTarget.scrollLeft);
  };

  // ── Layer reorder: compute drop index from clientY ──
  const getDropIndex = useCallback(
    (clientY: number): number => {
      if (!viewportRef.current) return 0;
      const rect = viewportRef.current.getBoundingClientRect();
      const y = clientY - rect.top + viewportRef.current.scrollTop;
      const layerRows = layout.rows.filter((r) => r.kind === 'layer');
      for (let i = 0; i < layerRows.length; i++) {
        const row = layerRows[i]!;
        const mid = row.top + row.height / 2;
        if (y < mid) return i;
      }
      return layerRows.length;
    },
    [layout.rows],
  );

  // ── Layer reorder handlers ──
  const onLayerPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: string) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      select(nodeId);

      const el = event.currentTarget;
      const startY = event.clientY;
      let dragging = false;
      let currentDropIndex = tracks.findIndex((t) => t.id === nodeId);
      let autoScrollId = 0;
      let lastClientY = event.clientY;

      const AUTOSCROLL_ZONE = 40;
      const AUTOSCROLL_SPEED = 4;

      const autoScroll = () => {
        if (!viewportRef.current || !dragging) return;
        const rect = viewportRef.current.getBoundingClientRect();
        const distFromTop = lastClientY - rect.top;
        const distFromBottom = rect.bottom - lastClientY;
        if (distFromTop < AUTOSCROLL_ZONE) {
          viewportRef.current.scrollTop -= AUTOSCROLL_SPEED;
        } else if (distFromBottom < AUTOSCROLL_ZONE) {
          viewportRef.current.scrollTop += AUTOSCROLL_SPEED;
        }
        autoScrollId = requestAnimationFrame(autoScroll);
      };

      const onMove = (e: globalThis.PointerEvent) => {
        e.preventDefault();
        lastClientY = e.clientY;
        const dy = Math.abs(e.clientY - startY);
        if (!dragging && dy > 4) {
          dragging = true;
          el.setPointerCapture(event.pointerId);
          window.document.body.style.userSelect = 'none';
          autoScrollId = requestAnimationFrame(autoScroll);
        }
        if (dragging) {
          currentDropIndex = getDropIndex(e.clientY);
          setLayerDragState({ draggedId: nodeId, dropIndex: currentDropIndex, startY });
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        cancelAnimationFrame(autoScrollId);
        window.document.body.style.userSelect = '';
        if (dragging) {
          const currentIndex = tracks.findIndex((t) => t.id === nodeId);
          if (currentDropIndex !== currentIndex && currentDropIndex !== currentIndex + 1) {
            const ids = [...document.rootNodeIds];
            ids.splice(currentIndex, 1);
            const insertAt = currentDropIndex > currentIndex ? currentDropIndex - 1 : currentDropIndex;
            ids.splice(insertAt, 0, nodeId);
            reorderLayers(ids);
          }
        }
        setLayerDragState(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [select, tracks, getDropIndex, document.rootNodeIds, reorderLayers],
  );

  // ── Compute drop indicator position ──
  const dropIndicatorTop = useMemo(() => {
    if (!layerDragState) return null;
    const layerRows = layout.rows.filter((r) => r.kind === 'layer');
    if (layerDragState.dropIndex >= layerRows.length) {
      const lastRow = layerRows[layerRows.length - 1];
      return lastRow ? lastRow.top + lastRow.height + TIMELINE_ROW_GAP / 2 : null;
    }
    const targetRow = layerRows[layerDragState.dropIndex];
    return targetRow ? targetRow.top - TIMELINE_ROW_GAP / 2 : null;
  }, [layerDragState, layout.rows]);

  return (
    <div className={styles.timeline}>
      {/* ── Transport bar ── */}
      <div className={styles.header}>
        <button type="button" className={styles.transportButton} onClick={jumpToStart} title="Jump to start">
          <SkipBack size={14} />
        </button>
        <button type="button" className={styles.transportButton} onClick={() => stepFrame(-1)} title="Previous frame">
          <ChevronLeft size={14} />
        </button>
        <button type="button" className={`${styles.transportButton} ${styles.transportButtonPlay}`} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" className={styles.transportButton} onClick={handleStop} title="Stop">
          <StopIcon size={14} />
        </button>
        <button type="button" className={styles.transportButton} onClick={() => stepFrame(1)} title="Next frame">
          <ChevronRight size={14} />
        </button>
        <button type="button" className={styles.transportButton} onClick={jumpToEnd} title="Jump to end">
          <SkipForward size={14} />
        </button>
        <button
          type="button"
          className={`${styles.transportButton} ${autoKeyframe ? styles.transportButtonActive : ''}`}
          onClick={toggleAutoKeyframe}
          title={autoKeyframe ? 'Auto-keyframe ON' : 'Auto-keyframe OFF'}
        >
          <KeyRound size={14} />
        </button>
        {selectedKeyframes.length > 0 && (
          <select
            className={styles.playButton}
            value=""
            onChange={(e) => {
              const easing = e.target.value as EasingPreset;
              if (!easing) return;
              for (const sel of selectedKeyframes) {
                setKeyframeEasing(sel.nodeId, sel.property, sel.time, easing);
              }
              e.target.value = '';
            }}
          >
            <option value="" disabled>Easing...</option>
            <option value="linear">Linear</option>
            <option value="ease-in">Ease In</option>
            <option value="ease-out">Ease Out</option>
            <option value="ease-in-out">Ease In/Out</option>
            <option value="hold">Hold (step)</option>
          </select>
        )}
        <div className={styles.timeReadout}>
          {currentTime.toFixed(2)}s · f{frame}
        </div>
      </div>

      {/* ── Scrollable viewport ── */}
      <div
        ref={viewportRef}
        className={`${styles.viewport}${draggingPlayhead ? ` ${styles.viewportScrubbing}` : ''}`}
        onPointerDown={beginScrub}
        onPointerMove={onScrubMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onWheel={onWheelTimeline}
        onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
      >
        <div
          className={styles.timelineSpace}
          style={{ width: `${totalWidth}px`, height: `${layout.totalHeight}px` }}
        >
          {/* ── Playhead (always on top) ── */}
          <div className={styles.playhead} style={{ left: `${playheadX}px` }}>
            <div className={styles.playheadHead} />
          </div>

          {/* ── Snap line ── */}
          {activeSnapTime !== null && (
            <div
              className={styles.snapLine}
              style={{ left: `${TIMELINE_LABEL_WIDTH + timeScale.toX(activeSnapTime)}px` }}
            />
          )}

          {/* ── Work area overlay ── */}
          {workAreaStart > 0 && (
            <div
              className={styles.workAreaInactive}
              style={{
                left: `${TIMELINE_LABEL_WIDTH}px`,
                width: `${timeScale.toX(workAreaStart)}px`,
              }}
            />
          )}
          {workAreaEnd < duration && (
            <div
              className={styles.workAreaInactive}
              style={{
                left: `${TIMELINE_LABEL_WIDTH + timeScale.toX(workAreaEnd)}px`,
                right: 0,
              }}
            />
          )}
          {(workAreaStart > 0 || workAreaEnd < duration) && (
            <div
              className={styles.workArea}
              style={{
                left: `${TIMELINE_LABEL_WIDTH + timeScale.toX(workAreaStart)}px`,
                width: `${timeScale.toX(workAreaEnd) - timeScale.toX(workAreaStart)}px`,
              }}
            />
          )}
          {/* Work area drag handles */}
          <WorkAreaHandle
            edge="start"
            time={workAreaStart}
            otherTime={workAreaEnd}
            xForTime={timeScale.toX}
            clampTime={timeScale.clampTime}
            pixelsPerSecond={timeScale.pixelsPerSecond}
            onChange={(t) => updateComposition({ workAreaStart: t })}
            labelWidth={TIMELINE_LABEL_WIDTH}
          />
          <WorkAreaHandle
            edge="end"
            time={workAreaEnd}
            otherTime={workAreaStart}
            xForTime={timeScale.toX}
            clampTime={timeScale.clampTime}
            pixelsPerSecond={timeScale.pixelsPerSecond}
            onChange={(t) => updateComposition({ workAreaEnd: t })}
            labelWidth={TIMELINE_LABEL_WIDTH}
          />

          {/* ── Drop indicator for layer reorder ── */}
          {dropIndicatorTop !== null && (
            <div className={styles.dropIndicator} style={{ top: `${dropIndicatorTop}px` }} />
          )}

          {/* ── Box select rectangle ── */}
          {boxSelectRect && (
            <div
              className={styles.boxSelectRect}
              style={{
                left: `${Math.min(boxSelectRect.x1, boxSelectRect.x2)}px`,
                top: `${Math.min(boxSelectRect.y1, boxSelectRect.y2)}px`,
                width: `${Math.abs(boxSelectRect.x2 - boxSelectRect.x1)}px`,
                height: `${Math.abs(boxSelectRect.y2 - boxSelectRect.y1)}px`,
              }}
            />
          )}

          {/* ── Ruler ── */}
          <div className={styles.row} style={{ top: 0, height: `${TIMELINE_RULER_HEIGHT}px` }}>
            <div className={`${styles.labelCell} ${styles.rulerLabel}`}>Time</div>
            <div className={`${styles.timeCell} ${styles.rulerCell}`}>
              {rulerTicks.map((tick) => (
                <div
                  key={`tick_${tick.time}`}
                  className={styles.rulerTick}
                  style={{ left: `${timeScale.toX(tick.time)}px` }}
                >
                  <div className={styles.rulerLine} />
                  {tick.label ? <div className={styles.rulerText}>{tick.label}</div> : null}
                </div>
              ))}
            </div>
          </div>

          {/* ── Layer + property rows ── */}
          {layout.rows.map((row) => {
            if (row.kind === 'layer') {
              const expanded = expandedLayers[row.node.id] ?? true;
              const isDragging = layerDragState?.draggedId === row.node.id;
              return (
                <div
                  key={row.id}
                  className={styles.row}
                  style={{ top: `${row.top}px`, height: `${row.height}px` }}
                >
                  <div
                    data-layer-label
                    className={`${styles.labelCell} ${styles.layerLabelCell}${isDragging ? ` ${styles.layerLabelCellDragging}` : ''}`}
                    onPointerDown={(e) => onLayerPointerDown(e, row.node.id)}
                  >
                    <button
                      type="button"
                      className={styles.expandButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedLayers((s) => ({ ...s, [row.node.id]: !expanded }));
                      }}
                    >
                      {expanded ? <ChevronDown size={12} /> : <ChevronRightIcon size={12} />}
                    </button>
                    <span className={styles.trackName}>
                      {selectedIds.has(row.node.id) ? '● ' : ''}
                      {row.node.name}
                    </span>
                  </div>
                  <div className={`${styles.timeCell} ${styles.layerTimeCell}`}>
                    <LayerBar
                      node={row.node}
                      xForTime={timeScale.toX}
                      onTimingChange={(startTime, endTime) => updateTiming(row.node.id, { startTime, endTime })}
                      clampTime={timeScale.clampTime}
                      pixelsPerSecond={timeScale.pixelsPerSecond}
                      getSnapTime={getSnapTime}
                      onSnapActive={setActiveSnapTime}
                    />
                  </div>
                </div>
              );
            }

            return (
              <PropertyRow
                key={row.id}
                top={row.top}
                height={row.height}
                node={row.node}
                property={row.property}
                label={row.label}
                currentTime={currentTime}
                onSeek={setCurrentTime}
                onAddKey={() => addKeyframeAtCurrentTime(row.node.id, row.property, currentTime)}
                xForTime={timeScale.toX}
                moveKeyframes={moveKeyframes}
                setSelectedKeyframes={setSelectedKeyframes}
                selectedKeyframes={selectedKeyframes}
                toggleKeyframeSelection={toggleKeyframeSelection}
                pixelsPerSecond={timeScale.pixelsPerSecond}
                getSnapTime={getSnapTime}
                onSnapActive={setActiveSnapTime}
                getNode={getNode}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * LayerBar — The clip bar. Move / trim left / trim right.
 * All operations modify the REAL document (startTime/endTime).
 * Snap feedback integrated.
 * ═══════════════════════════════════════════════════════════════ */
function LayerBar({
  node,
  xForTime,
  onTimingChange,
  clampTime,
  pixelsPerSecond,
  getSnapTime,
  onSnapActive,
}: {
  node: SceneNode;
  xForTime: (time: number) => number;
  onTimingChange: (start: number, end: number) => void;
  clampTime: (time: number) => number;
  pixelsPerSecond: number;
  getSnapTime: (time: number, lock: boolean, disable: boolean) => { time: number; snapped: number | null };
  onSnapActive: (time: number | null) => void;
}) {
  const [mode, setMode] = useState<'move' | 'left' | 'right' | null>(null);
  const startRef = useRef<{ start: number; end: number; pointerX: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, nextMode: 'move' | 'left' | 'right') => {
    event.stopPropagation();
    event.preventDefault();
    setMode(nextMode);
    startRef.current = { start: node.startTime, end: node.endTime, pointerX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!mode || !startRef.current) return;
    event.preventDefault();
    const deltaPx = event.clientX - startRef.current.pointerX;
    const deltaTime = deltaPx / pixelsPerSecond;
    const clipDuration = startRef.current.end - startRef.current.start;
    const shift = event.shiftKey;
    const alt = event.altKey;

    if (mode === 'move') {
      const rawStart = startRef.current.start + deltaTime;
      const { time: snappedStart, snapped } = getSnapTime(rawStart, shift, alt);
      const start = clampTime(snappedStart);
      const end = clampTime(start + clipDuration);
      const adjustedStart = end - clipDuration;
      onTimingChange(Math.max(0, adjustedStart), end);
      // Also try snapping the end edge
      if (snapped === null) {
        const { snapped: endSnapped } = getSnapTime(rawStart + clipDuration, shift, alt);
        onSnapActive(endSnapped);
      } else {
        onSnapActive(snapped);
      }
      return;
    }
    if (mode === 'left') {
      const rawStart = startRef.current.start + deltaTime;
      const { time: snappedStart, snapped } = getSnapTime(rawStart, shift, alt);
      const nextStart = clampTime(Math.min(startRef.current.end - 0.01, snappedStart));
      onTimingChange(nextStart, startRef.current.end);
      onSnapActive(snapped);
      return;
    }
    // right trim
    const rawEnd = startRef.current.end + deltaTime;
    const { time: snappedEnd, snapped } = getSnapTime(rawEnd, shift, alt);
    const nextEnd = clampTime(Math.max(startRef.current.start + 0.01, snappedEnd));
    onTimingChange(startRef.current.start, nextEnd);
    onSnapActive(snapped);
  };

  const onPointerUp = () => {
    setMode(null);
    onSnapActive(null);
  };

  const left = xForTime(node.startTime);
  const width = Math.max(4, xForTime(node.endTime) - left);

  return (
    <div
      data-clip-bar
      className={`${styles.layerClipBar}${mode ? ` ${styles.layerClipBarDragging}` : ''}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        cursor: mode === 'move' ? 'grabbing' : undefined,
      }}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={styles.layerTrimHandle} onPointerDown={(e) => onPointerDown(e, 'left')} />
      <div className={styles.layerTrimHandle} onPointerDown={(e) => onPointerDown(e, 'right')} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * WorkAreaHandle — Draggable handle for work area start/end.
 * ═══════════════════════════════════════════════════════════════ */
function WorkAreaHandle({
  edge,
  time,
  otherTime,
  xForTime,
  clampTime,
  pixelsPerSecond,
  onChange,
  labelWidth,
}: {
  edge: 'start' | 'end';
  time: number;
  otherTime: number;
  xForTime: (time: number) => number;
  clampTime: (time: number) => number;
  pixelsPerSecond: number;
  onChange: (time: number) => void;
  labelWidth: number;
}) {
  const startRef = useRef<{ time: number; pointerX: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    startRef.current = { time, pointerX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    event.preventDefault();
    const deltaPx = event.clientX - startRef.current.pointerX;
    const deltaTime = deltaPx / pixelsPerSecond;
    const rawTime = startRef.current.time + deltaTime;
    const clamped = clampTime(
      edge === 'start'
        ? Math.min(rawTime, otherTime - 0.01)
        : Math.max(rawTime, otherTime + 0.01),
    );
    onChange(clamped);
  };

  const onPointerUp = () => {
    startRef.current = null;
  };

  const x = labelWidth + xForTime(time);

  return (
    <div
      className={styles.workAreaHandle}
      style={{ left: `${x - 4}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
 * PropertyRow — Keyframes for one property of one node.
 * Keyframe times are LOCAL. Displayed at global position.
 * Drag with snap + tooltip. Shift=lock snap. Alt=no snap.
 * ═══════════════════════════════════════════════════════════════ */
function PropertyRow({
  node,
  property,
  label,
  currentTime,
  onSeek,
  onAddKey,
  xForTime,
  top,
  height,
  moveKeyframes,
  selectedKeyframes,
  setSelectedKeyframes,
  toggleKeyframeSelection,
  pixelsPerSecond,
  getSnapTime,
  onSnapActive,
  getNode,
}: {
  node: SceneNode;
  property: AnimatableProperty;
  label: string;
  currentTime: number;
  onSeek: (time: number) => void;
  onAddKey: () => void;
  xForTime: (time: number) => number;
  top: number;
  height: number;
  moveKeyframes: (moves: Array<{ nodeId: string; property: AnimatableProperty; fromLocalTime: number; toLocalTime: number }>) => void;
  getNode: (nodeId: string) => SceneNode | undefined;
  selectedKeyframes: { nodeId: string; property: AnimatableProperty; time: number }[];
  setSelectedKeyframes: (selection: { nodeId: string; property: AnimatableProperty; time: number }[]) => void;
  toggleKeyframeSelection: (selection: { nodeId: string; property: AnimatableProperty; time: number }) => void;
  pixelsPerSecond: number;
  getSnapTime: (time: number, lock: boolean, disable: boolean) => { time: number; snapped: number | null };
  onSnapActive: (time: number | null) => void;
}) {
  const keyframes = node.animation.properties[property].keyframes;
  const clipDuration = getClipDuration(node);
  const localTime = globalToLocalTime(currentTime, node);

  // Only show keyframes within clip
  const visibleKeyframes = keyframes.filter((k) => k.time >= -1e-6 && k.time <= clipDuration + 1e-6);

  // Drag tooltip state
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; time: number } | null>(null);

  const navigateKeyframe = (direction: 'prev' | 'next') => {
    if (visibleKeyframes.length === 0) return;
    const sorted = [...visibleKeyframes].sort((a, b) => a.time - b.time);
    const target =
      direction === 'prev'
        ? [...sorted].reverse().find((k) => k.time < localTime - 1e-6)
        : sorted.find((k) => k.time > localTime + 1e-6);
    if (target) onSeek(localToGlobalTime(target.time, node));
  };


  return (
    <div className={styles.row} style={{ top: `${top}px`, height: `${height}px` }}>
      <div className={`${styles.labelCell} ${styles.propertyLabelCell}`}>
        <div className={styles.propertyLabel}>{label}</div>
        <button type="button" className={styles.miniButton} onClick={() => navigateKeyframe('prev')} title="Previous keyframe">
          <ChevronLeft size={12} />
        </button>
        <button
          type="button"
          className={`${styles.miniButton} ${hasKeyframeAtTime(node, property, localTime) ? styles.keyframeButtonActive : ''}`}
          onClick={onAddKey}
          title={hasKeyframeAtTime(node, property, localTime) ? 'Keyframe at current time' : 'Add keyframe'}
        >
          <Diamond size={10} fill={hasKeyframeAtTime(node, property, localTime) ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className={styles.miniButton} onClick={() => navigateKeyframe('next')} title="Next keyframe">
          <ChevronRight size={12} />
        </button>
      </div>

      <div data-property-time-cell className={`${styles.timeCell} ${styles.propertyTimeCell}`}>
        {visibleKeyframes.map((key) => {
          const globalTime = localToGlobalTime(key.time, node);
          const left = xForTime(globalTime);
          const isSelected = selectedKeyframes.some(
            (sel) =>
              sel.nodeId === node.id &&
              sel.property === property &&
              Math.abs(sel.time - key.time) < 1e-6,
          );
          return (
            <button
              key={`${node.id}_${property}_${key.time}`}
              type="button"
              data-keyframe-button
              className={`${styles.keyDiamond}${isSelected ? ` ${styles.keyDiamondSelected}` : ''}`}
              style={{ left: `${left}px` }}
              title={`${globalTime.toFixed(2)}s`}
              onClick={(event) => {
                event.stopPropagation();
                const selection = { nodeId: node.id, property, time: key.time };
                if (event.shiftKey) {
                  toggleKeyframeSelection(selection);
                } else {
                  setSelectedKeyframes([selection]);
                }
                onSeek(globalTime);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                const baseX = event.clientX;

                // Determine which keyframes to drag
                const thisSel = { nodeId: node.id, property, time: key.time };
                const alreadySelected = selectedKeyframes.some(
                  (sel) => sel.nodeId === thisSel.nodeId && sel.property === thisSel.property && Math.abs(sel.time - thisSel.time) < 1e-6,
                );
                const dragSet = alreadySelected && selectedKeyframes.length > 1
                  ? selectedKeyframes
                  : [thisSel];

                // Track last local times per keyframe using index (unique per keyframe)
                // This avoids the bug where two keyframes on the same property share a map key
                const lastTimes: number[] = dragSet.map((sel) => sel.time);
                const initialGlobalTime = localToGlobalTime(key.time, node);

                window.document.body.style.userSelect = 'none';

                const move = (e: globalThis.PointerEvent) => {
                  e.preventDefault();
                  const deltaPx = e.clientX - baseX;
                  const rawGlobalTime = initialGlobalTime + deltaPx / pixelsPerSecond;
                  const { time: snappedGlobal, snapped } = getSnapTime(rawGlobalTime, e.shiftKey, e.altKey);
                  const globalDelta = snappedGlobal - initialGlobalTime;

                  // Build batch moves: collect all from→to pairs
                  const moves: Array<{ nodeId: string; property: AnimatableProperty; fromLocalTime: number; toLocalTime: number }> = [];
                  const newTimes: number[] = [];
                  for (let i = 0; i < dragSet.length; i++) {
                    const sel = dragSet[i]!;
                    const selNode = sel.nodeId === node.id ? node : getNode(sel.nodeId);
                    if (!selNode) {
                      newTimes.push(lastTimes[i]!);
                      continue;
                    }
                    const fromTime = lastTimes[i]!;
                    const newLocalTime = clampKeyframeTime(sel.time + globalDelta, selNode);
                    newTimes.push(newLocalTime);
                    if (Math.abs(newLocalTime - fromTime) > 1e-9) {
                      moves.push({
                        nodeId: sel.nodeId,
                        property: sel.property,
                        fromLocalTime: fromTime,
                        toLocalTime: newLocalTime,
                      });
                    }
                  }

                  // Apply all moves atomically to prevent collisions
                  if (moves.length > 0) {
                    moveKeyframes(moves);
                    for (let i = 0; i < newTimes.length; i++) {
                      lastTimes[i] = newTimes[i]!;
                    }
                  }

                  onSnapActive(snapped);
                  const primaryNewLocal = clampKeyframeTime(key.time + globalDelta, node);
                  setDragTooltip({ x: e.clientX, y: e.clientY, time: localToGlobalTime(primaryNewLocal, node) });
                };
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                  window.document.body.style.userSelect = '';
                  onSnapActive(null);
                  setDragTooltip(null);
                  // Update selected keyframes to their new times
                  const updatedSelection = dragSet.map((sel, i) => ({
                    ...sel,
                    time: lastTimes[i] ?? sel.time,
                  }));
                  setSelectedKeyframes(updatedSelection);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            />
          );
        })}
      </div>

      {/* Drag tooltip */}
      {dragTooltip && (
        <div
          className={styles.keyDragTooltip}
          style={{ left: dragTooltip.x, top: dragTooltip.y }}
        >
          {dragTooltip.time.toFixed(2)}s
        </div>
      )}
    </div>
  );
}
