import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import type { AnimatableProperty, SceneNode } from '@/document/types';
import { evaluateNodeAtTime, hasKeyframeAtTime, isPropertyAnimated } from '@/engine/animation';
import { useDocumentStore, useEditorStore, useTimelineStore } from '@/state';
import { buildTimelineLayout, TIMELINE_LABEL_WIDTH, TIMELINE_RULER_HEIGHT } from './timelineLayout';
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
  const moveKeyframe = useDocumentStore((s) => s.moveKeyframe);
  const setKeyframe = useDocumentStore((s) => s.setKeyframe);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const autoKeyframe = useTimelineStore((s) => s.autoKeyframe);
  const toggleAutoKeyframe = useTimelineStore((s) => s.toggleAutoKeyframe);
  const timeScaleValue = useTimelineStore((s) => s.timeScale);
  const setTimeScale = useTimelineStore((s) => s.setTimeScale);
  const scrollX = useTimelineStore((s) => s.scrollX);
  const setScrollX = useTimelineStore((s) => s.setScrollX);
  const selectedKeyframes = useTimelineStore((s) => s.selectedKeyframes);
  const setSelectedKeyframes = useTimelineStore((s) => s.setSelectedKeyframes);
  const toggleKeyframeSelection = useTimelineStore((s) => s.toggleKeyframeSelection);
  const layerTimingByNodeId = useTimelineStore((s) => s.layerTimingByNodeId);
  const ensureLayerTiming = useTimelineStore((s) => s.ensureLayerTiming);
  const setLayerTiming = useTimelineStore((s) => s.setLayerTiming);

  const selectedIds = useEditorStore((s) => s.selectedIds);
  const addKeyframeAtCurrentTime = useDocumentStore((s) => s.addKeyframeAtCurrentTime);
  const togglePropertyStopwatch = useDocumentStore((s) => s.togglePropertyStopwatch);

  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [clipboardKeys, setClipboardKeys] = useState<{ nodeId: string; property: AnimatableProperty; time: number; value: number }[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const resumePlaybackRef = useRef(false);

  const { duration, fps } = document.composition;
  const frame = Math.round(currentTime * fps);
  const frameStep = 1 / Math.max(1, fps);

  const tracks = useMemo(
    () =>
      document.rootNodeIds
        .map((id) => document.nodes[id])
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    [document],
  );

  useEffect(() => {
    for (const track of tracks) {
      ensureLayerTiming(track.id, duration);
    }
  }, [duration, ensureLayerTiming, tracks]);

  const timeScale = useMemo(() => createTimelineTimeScale(duration, timeScaleValue), [duration, timeScaleValue]);
  const layout = useMemo(
    () => buildTimelineLayout(tracks, expandedLayers, PROPERTIES),
    [tracks, expandedLayers],
  );

  const totalWidth = TIMELINE_LABEL_WIDTH + timeScale.contentWidth;
  const playheadX = TIMELINE_LABEL_WIDTH + timeScale.toX(currentTime);

  const allSnapTimes = useMemo(() => {
    const keyTimes: number[] = [];
    for (const node of tracks) {
      for (const property of PROPERTIES) {
        for (const key of node.animation.properties[property.key].keyframes) {
          keyTimes.push(key.time);
        }
      }
      const layerTiming = layerTimingByNodeId[node.id];
      if (layerTiming) {
        keyTimes.push(layerTiming.startTime, layerTiming.endTime);
      }
    }
    return keyTimes;
  }, [layerTimingByNodeId, tracks]);

  const getSnapTime = (time: number, lockSnap: boolean, disableSnap: boolean) => {
    if (disableSnap) return timeScale.clampTime(time);
    const candidates = [currentTime, ...allSnapTimes];
    const frameTime = 1 / Math.max(1, fps);
    candidates.push(Math.round(time / frameTime) * frameTime);
    let snapped = time;
    let minDistance = lockSnap ? Infinity : SNAP_PX / timeScale.pixelsPerSecond;
    for (const candidate of candidates) {
      const d = Math.abs(candidate - time);
      if (d < minDistance) {
        minDistance = d;
        snapped = candidate;
      }
    }
    return timeScale.clampTime(snapped);
  };

  const updateTimeFromClientX = (clientX: number, lockSnap = false, disableSnap = false) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const pixelInSpace = clientX - rect.left + viewportRef.current.scrollLeft;
    const pixelInTimeline = pixelInSpace - TIMELINE_LABEL_WIDTH;
    const nextTime = getSnapTime(timeScale.toTime(pixelInTimeline), lockSnap, disableSnap);
    setCurrentTime(nextTime);
  };

  const beginScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('button') && !event.target.closest('[data-keyframe-button="true"]'))
      return;
    if (event.target.closest('[data-keyframe-button="true"]')) return;

    resumePlaybackRef.current = isPlaying;
    if (isPlaying) pause();

    setDraggingPlayhead(true);
    updateTimeFromClientX(event.clientX, event.shiftKey, event.altKey);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onScrubMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingPlayhead) return;
    updateTimeFromClientX(event.clientX, event.shiftKey, event.altKey);
  };

  const endScrub = (event: PointerEvent<HTMLDivElement>) => {
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        const copied = selectedKeyframes
          .map((selection) => {
            const node = document.nodes[selection.nodeId];
            const key = node?.animation.properties[selection.property].keyframes.find(
              (entry) => Math.abs(entry.time - selection.time) < 1e-6,
            );
            if (!key) return null;
            return { ...selection, value: key.value };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        setClipboardKeys(copied);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboardKeys.length > 0) {
        const minTime = Math.min(...clipboardKeys.map((key) => key.time));
        for (const key of clipboardKeys) {
          setKeyframe(key.nodeId, key.property, currentTime + (key.time - minTime), key.value);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clipboardKeys, currentTime, document.nodes, selectedKeyframes, setKeyframe]);

  const rulerTicks = useMemo(() => {
    const pixelsPerSecond = timeScale.pixelsPerSecond;
    const majorStep = pixelsPerSecond > 320 ? 0.1 : pixelsPerSecond > 180 ? 0.25 : pixelsPerSecond > 80 ? 0.5 : 1;
    const ticks: { time: number; label?: string }[] = [];
    for (let t = 0; t <= duration + 1e-6; t += majorStep) {
      const major = Math.abs((t / majorStep) % 2) < 1e-6;
      ticks.push({ time: t, label: major ? `${t.toFixed(majorStep < 1 ? 2 : 0)}s` : undefined });
    }
    return ticks;
  }, [duration, timeScale.pixelsPerSecond]);

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
        const nextTimeScale = createTimelineTimeScale(duration, nextScale);
        viewportRef.current.scrollLeft = Math.max(
          0,
          TIMELINE_LABEL_WIDTH + nextTimeScale.toX(pointerTime) - (event.clientX - rect.left),
        );
      });
      return;
    }
    setScrollX(event.currentTarget.scrollLeft);
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <button type="button" className={styles.playButton} onClick={jumpToStart}>
          ⏮ Start
        </button>
        <button type="button" className={styles.playButton} onClick={() => stepFrame(-1)}>
          ◀ Frame
        </button>
        <button type="button" className={styles.playButton} onClick={handlePlayPause}>
          {isPlaying ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button type="button" className={styles.playButton} onClick={handleStop}>
          ⏹ Stop
        </button>
        <button type="button" className={styles.playButton} onClick={() => stepFrame(1)}>
          Frame ▶
        </button>
        <button type="button" className={styles.playButton} onClick={jumpToEnd}>
          End ⏭
        </button>
        <button type="button" className={styles.playButton} onClick={toggleAutoKeyframe}>
          {autoKeyframe ? 'Auto-Key ON' : 'Auto-Key OFF'}
        </button>
        <div className={styles.timeReadout}>
          t={currentTime.toFixed(3)}s · f={frame} · scale={timeScaleValue.toFixed(2)} · scroll={Math.round(scrollX)}px
          {hoverTime !== null ? ` · hover=${hoverTime.toFixed(3)}s` : ''}
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={beginScrub}
        onPointerMove={onScrubMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onMouseMove={(e) => {
          if (!viewportRef.current) return;
          const rect = viewportRef.current.getBoundingClientRect();
          const pixelInSpace = e.clientX - rect.left + viewportRef.current.scrollLeft;
          const pixelInTimeline = pixelInSpace - TIMELINE_LABEL_WIDTH;
          setHoverTime(timeScale.toTime(pixelInTimeline));
        }}
        onMouseLeave={() => setHoverTime(null)}
        onWheel={onWheelTimeline}
        onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
      >
        <div
          className={styles.timelineSpace}
          style={{ width: `${totalWidth}px`, height: `${layout.totalHeight}px` }}
        >
          <div className={styles.playhead} style={{ left: `${playheadX}px` }}>
            <div className={styles.playheadHead} />
          </div>

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

          {layout.rows.map((row) => {
            if (row.kind === 'layer') {
              const expanded = expandedLayers[row.node.id] ?? true;
              const layerTiming = layerTimingByNodeId[row.node.id] ?? { startTime: 0, endTime: duration };
              return (
                <div
                  key={row.id}
                  className={styles.row}
                  style={{ top: `${row.top}px`, height: `${row.height}px` }}
                >
                  <div className={`${styles.labelCell} ${styles.layerLabelCell}`}>
                    <button
                      type="button"
                      className={styles.expandButton}
                      onClick={() => setExpandedLayers((s) => ({ ...s, [row.node.id]: !expanded }))}
                    >
                      {expanded ? '▾' : '▸'}
                    </button>
                    <span className={styles.trackName}>
                      {selectedIds.has(row.node.id) ? '● ' : ''}
                      {row.node.name}
                    </span>
                  </div>
                  <div className={`${styles.timeCell} ${styles.layerTimeCell}`}>
                    <LayerBar
                      startTime={layerTiming.startTime}
                      endTime={layerTiming.endTime}
                      xForTime={timeScale.toX}
                      onChange={(startTime, endTime) => setLayerTiming(row.node.id, { startTime, endTime })}
                      clampTime={timeScale.clampTime}
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
                onToggleStopwatch={() =>
                  togglePropertyStopwatch(row.node.id, row.property, currentTime)
                }
                xForTime={timeScale.toX}
                toTime={timeScale.toTime}
                clampTime={timeScale.clampTime}
                moveKeyframe={moveKeyframe}
                setSelectedKeyframes={setSelectedKeyframes}
                selectedKeyframes={selectedKeyframes}
                toggleKeyframeSelection={toggleKeyframeSelection}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LayerBar({
  startTime,
  endTime,
  xForTime,
  onChange,
  clampTime,
}: {
  startTime: number;
  endTime: number;
  xForTime: (time: number) => number;
  onChange: (start: number, end: number) => void;
  clampTime: (time: number) => number;
}) {
  const [mode, setMode] = useState<'move' | 'left' | 'right' | null>(null);
  const startRef = useRef<{ start: number; end: number; pointerX: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, nextMode: 'move' | 'left' | 'right') => {
    event.stopPropagation();
    setMode(nextMode);
    startRef.current = { start: startTime, end: endTime, pointerX: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!mode || !startRef.current) return;
    const deltaPx = event.clientX - startRef.current.pointerX;
    const duration = startRef.current.end - startRef.current.start;
    const pixels = Math.max(1, xForTime(1));
    const deltaTime = deltaPx / pixels;
    if (mode === 'move') {
      const start = clampTime(startRef.current.start + deltaTime);
      onChange(start, clampTime(start + duration));
      return;
    }
    if (mode === 'left') {
      const nextStart = clampTime(Math.min(startRef.current.end - 0.01, startRef.current.start + deltaTime));
      onChange(nextStart, startRef.current.end);
      return;
    }
    const nextEnd = clampTime(Math.max(startRef.current.start + 0.01, startRef.current.end + deltaTime));
    onChange(startRef.current.start, nextEnd);
  };

  return (
    <div
      className={styles.layerClipBar}
      style={{ left: `${xForTime(startTime)}px`, width: `${Math.max(4, xForTime(endTime) - xForTime(startTime))}px` }}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={() => setMode(null)}
    >
      <div className={styles.layerTrimHandle} onPointerDown={(e) => onPointerDown(e, 'left')} />
      <div className={styles.layerTrimHandle} onPointerDown={(e) => onPointerDown(e, 'right')} />
    </div>
  );
}

function PropertyRow({
  node,
  property,
  label,
  currentTime,
  onSeek,
  onAddKey,
  onToggleStopwatch,
  xForTime,
  toTime,
  clampTime,
  top,
  height,
  moveKeyframe,
  selectedKeyframes,
  setSelectedKeyframes,
  toggleKeyframeSelection,
}: {
  node: SceneNode;
  property: AnimatableProperty;
  label: string;
  currentTime: number;
  onSeek: (time: number) => void;
  onAddKey: () => void;
  onToggleStopwatch: () => void;
  xForTime: (time: number) => number;
  toTime: (x: number) => number;
  clampTime: (time: number) => number;
  top: number;
  height: number;
  moveKeyframe: (nodeId: string, property: AnimatableProperty, fromTime: number, toTime: number) => void;
  selectedKeyframes: { nodeId: string; property: AnimatableProperty; time: number }[];
  setSelectedKeyframes: (selection: { nodeId: string; property: AnimatableProperty; time: number }[]) => void;
  toggleKeyframeSelection: (selection: { nodeId: string; property: AnimatableProperty; time: number }) => void;
}) {
  const isAnimated = isPropertyAnimated(node, property);
  const keyframes = node.animation.properties[property].keyframes;

  const navigateKeyframe = (direction: 'prev' | 'next') => {
    if (keyframes.length === 0) return;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const target =
      direction === 'prev'
        ? [...sorted].reverse().find((k) => k.time < currentTime - 1e-6)
        : sorted.find((k) => k.time > currentTime + 1e-6);
    if (target) onSeek(target.time);
  };

  const currentValue = evaluateNodeAtTime(node, currentTime);
  const display =
    property === 'opacity'
      ? `${Math.round(currentValue.style.opacity * 100)}%`
      : `${Number(currentValue.transform[property as keyof typeof currentValue.transform]).toFixed(2)}`;

  return (
    <div className={styles.row} style={{ top: `${top}px`, height: `${height}px` }}>
      <div className={`${styles.labelCell} ${styles.propertyLabelCell}`}>
        <div className={styles.propertyLabel}>{label}</div>
        <button type="button" className={styles.stopwatchButton} onClick={onToggleStopwatch}>
          {isAnimated ? '⏱' : '◌'}
        </button>
        <button
          type="button"
          className={styles.miniButton}
          onClick={() => navigateKeyframe('prev')}
        >
          ◀
        </button>
        <button type="button" className={styles.miniButton} onClick={onAddKey}>
          {hasKeyframeAtTime(node, property, currentTime) ? '◆' : '+'}
        </button>
        <button
          type="button"
          className={styles.miniButton}
          onClick={() => navigateKeyframe('next')}
        >
          ▶
        </button>
        <div className={styles.valueReadout}>{display}</div>
      </div>

      <div className={`${styles.timeCell} ${styles.propertyTimeCell}`}>
        {keyframes.map((key) => {
          const left = xForTime(key.time);
          const isSelected = selectedKeyframes.some(
            (selection) => selection.nodeId === node.id && selection.property === property && Math.abs(selection.time - key.time) < 1e-6,
          );
          return (
            <button
              key={`${node.id}_${property}_${key.time}`}
              type="button"
              data-keyframe-button="true"
              className={`${styles.keyDiamond}${isSelected ? ` ${styles.keyDiamondSelected}` : ''}`}
              style={{ left: `${left}px` }}
              title={`${key.time.toFixed(2)}s`}
              onClick={(event) => {
                const selection = { nodeId: node.id, property, time: key.time };
                if (event.shiftKey) {
                  toggleKeyframeSelection(selection);
                } else {
                  setSelectedKeyframes([selection]);
                }
                onSeek(key.time);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                const initialTime = key.time;
                const baseX = event.clientX;
                const move = (pointerEvent: PointerEvent) => {
                  const deltaPx = pointerEvent.clientX - baseX;
                  const nextTime = clampTime(toTime(xForTime(initialTime) + deltaPx));
                  moveKeyframe(node.id, property, initialTime, nextTime);
                };
                const up = () => {
                  window.removeEventListener('pointermove', move as unknown as EventListener);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move as unknown as EventListener);
                window.addEventListener('pointerup', up);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
