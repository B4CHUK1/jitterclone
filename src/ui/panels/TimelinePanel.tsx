import { useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { AnimatableProperty, SceneNode } from '@/document/types';
import { evaluateNodeAtTime, hasKeyframeAtTime, isPropertyAnimated } from '@/engine/animation';
import { useDocumentStore, useEditorStore, useTimelineStore } from '@/state';
import { pixelToTime, timeToPixel } from './timelineMapping';
import styles from './TimelinePanel.module.css';

const PROPERTIES: { key: AnimatableProperty; label: string }[] = [
  { key: 'x', label: 'Position X' },
  { key: 'y', label: 'Position Y' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'scaleX', label: 'Scale X' },
  { key: 'scaleY', label: 'Scale Y' },
  { key: 'opacity', label: 'Opacity' },
];

export function TimelinePanel() {
  const document = useDocumentStore((s) => s.document);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const togglePlay = useTimelineStore((s) => s.togglePlay);
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

  const tracks = useMemo(
    () =>
      document.rootNodeIds
        .map((id) => document.nodes[id])
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    [document],
  );

  const clampTime = (value: number) => Math.max(0, Math.min(duration, value));
  const contentWidth = Math.max(640, timeToPixel(duration, zoom) + 80);
  const playheadX = timeToPixel(clampTime(currentTime), zoom);

  const updateTimeFromClientX = (clientX: number) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const pixelInContent = clientX - rect.left + viewportRef.current.scrollLeft;
    setCurrentTime(clampTime(pixelToTime(pixelInContent, zoom)));
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

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <button type="button" className={styles.playButton} onClick={togglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
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
        <div className={styles.timelineSpace} style={{ width: `${contentWidth}px` }}>
          <div className={styles.playhead} style={{ left: `${playheadX}px` }}>
            <div className={styles.playheadHead} />
          </div>

          <div className={styles.tracks}>
            {tracks.map((node) => {
              const expanded = expandedLayers[node.id] ?? true;
              return (
                <div key={node.id} className={styles.trackGroup}>
                  <div className={styles.trackRow}>
                    <button
                      type="button"
                      className={styles.expandButton}
                      onClick={() => setExpandedLayers((s) => ({ ...s, [node.id]: !expanded }))}
                    >
                      {expanded ? '▾' : '▸'}
                    </button>
                    <div className={styles.trackName}>
                      {selectedIds.has(node.id) ? '● ' : ''}
                      {node.name}
                    </div>
                    <div className={styles.trackKeys} />
                  </div>
                  {expanded &&
                    PROPERTIES.map((property) => (
                      <PropertyRow
                        key={`${node.id}_${property.key}`}
                        node={node}
                        property={property.key}
                        label={property.label}
                        currentTime={currentTime}
                        onSeek={setCurrentTime}
                        onAddKey={() =>
                          addKeyframeAtCurrentTime(node.id, property.key, currentTime)
                        }
                        onToggleStopwatch={() =>
                          togglePropertyStopwatch(node.id, property.key, currentTime)
                        }
                      />
                    ))}
                </div>
              );
            })}
          </div>
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
}: {
  node: SceneNode;
  property: AnimatableProperty;
  label: string;
  currentTime: number;
  onSeek: (time: number) => void;
  onAddKey: () => void;
  onToggleStopwatch: () => void;
}) {
  const isAnimated = isPropertyAnimated(node, property);
  const keyframes = node.animation.properties[property].keyframes;
  const zoom = useTimelineStore((s) => s.zoom);
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
    <div className={styles.propertyRow}>
      <div className={styles.propertyLabel}>{label}</div>
      <button type="button" className={styles.stopwatchButton} onClick={onToggleStopwatch}>
        {isAnimated ? '⏱' : '◌'}
      </button>
      <button type="button" className={styles.miniButton} onClick={() => navigateKeyframe('prev')}>
        ◀
      </button>
      <button type="button" className={styles.miniButton} onClick={onAddKey}>
        {hasKeyframeAtTime(node, property, currentTime) ? '◆' : '+'}
      </button>
      <button type="button" className={styles.miniButton} onClick={() => navigateKeyframe('next')}>
        ▶
      </button>
      <div className={styles.valueReadout}>{display}</div>
      <div className={styles.trackKeys}>
        {keyframes.map((key) => {
          const left = timeToPixel(key.time, zoom);
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
