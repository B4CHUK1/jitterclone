import { useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
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

export function TimelinePanel() {
  const document = useDocumentStore((s) => s.document);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const autoKeyframe = useTimelineStore((s) => s.autoKeyframe);
  const toggleAutoKeyframe = useTimelineStore((s) => s.toggleAutoKeyframe);
  const zoom = useTimelineStore((s) => s.zoom);
  const scrollOffset = useTimelineStore((s) => s.scrollOffset);
  const setScrollOffset = useTimelineStore((s) => s.setScrollOffset);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const addKeyframeAtCurrentTime = useDocumentStore((s) => s.addKeyframeAtCurrentTime);
  const togglePropertyStopwatch = useDocumentStore((s) => s.togglePropertyStopwatch);

  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
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

  const timeScale = useMemo(() => createTimelineTimeScale(duration, zoom), [duration, zoom]);
  const layout = useMemo(
    () => buildTimelineLayout(tracks, expandedLayers, PROPERTIES),
    [tracks, expandedLayers],
  );

  const totalWidth = TIMELINE_LABEL_WIDTH + timeScale.contentWidth;
  const playheadX = TIMELINE_LABEL_WIDTH + timeScale.toX(currentTime);

  const updateTimeFromClientX = (clientX: number) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const pixelInSpace = clientX - rect.left + viewportRef.current.scrollLeft;
    const pixelInTimeline = pixelInSpace - TIMELINE_LABEL_WIDTH;
    setCurrentTime(timeScale.toTime(pixelInTimeline));
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
    updateTimeFromClientX(event.clientX);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onScrubMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingPlayhead) return;
    updateTimeFromClientX(event.clientX);
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

  const rulerTicks = useMemo(() => {
    const majorStep = duration <= 10 ? 0.5 : 1;
    const ticks: { time: number; label?: string }[] = [];
    for (let t = 0; t <= duration + 1e-6; t += majorStep) {
      const major = Math.abs(t % 1) < 1e-6 || majorStep >= 1;
      ticks.push({ time: t, label: major ? `${t.toFixed(majorStep < 1 ? 1 : 0)}s` : undefined });
    }
    return ticks;
  }, [duration]);

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
          t={currentTime.toFixed(2)}s · f={frame} · scroll={Math.round(scrollOffset)}px
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={beginScrub}
        onPointerMove={onScrubMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onScroll={(e) => setScrollOffset(e.currentTarget.scrollLeft)}
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
                    <div
                      className={styles.layerClipBar}
                      style={{
                        left: `${timeScale.toX(0)}px`,
                        width: `${timeScale.toX(duration)}px`,
                      }}
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
              />
            );
          })}
        </div>
      </div>
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
  top,
  height,
}: {
  node: SceneNode;
  property: AnimatableProperty;
  label: string;
  currentTime: number;
  onSeek: (time: number) => void;
  onAddKey: () => void;
  onToggleStopwatch: () => void;
  xForTime: (time: number) => number;
  top: number;
  height: number;
}) {
  const isAnimated = isPropertyAnimated(node, property);
  const keyframes = node.animation.properties[property].keyframes;
  const selectedKeyframe = useTimelineStore((s) => s.selectedKeyframe);
  const selectKeyframe = useTimelineStore((s) => s.selectKeyframe);

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
          const isSelected =
            selectedKeyframe?.nodeId === node.id &&
            selectedKeyframe.property === property &&
            Math.abs(selectedKeyframe.time - key.time) < 1e-6;
          return (
            <button
              key={`${node.id}_${property}_${key.time}`}
              type="button"
              data-keyframe-button="true"
              className={`${styles.keyDiamond}${isSelected ? ` ${styles.keyDiamondSelected}` : ''}`}
              style={{ left: `${left}px` }}
              title={`${key.time.toFixed(2)}s`}
              onClick={() => {
                selectKeyframe({ nodeId: node.id, property, time: key.time });
                onSeek(key.time);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
