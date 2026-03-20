import { useMemo, useState } from 'react';
import type { AnimatableProperty, SceneNode } from '@/document/types';
import { evaluateNodeAtTime, hasKeyframeAtTime, isPropertyAnimated } from '@/engine/animation';
import { useDocumentStore, useEditorStore, useTimelineStore } from '@/state';
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
  const togglePlay = useTimelineStore((s) => s.togglePlay);
  const autoKeyframe = useTimelineStore((s) => s.autoKeyframe);
  const toggleAutoKeyframe = useTimelineStore((s) => s.toggleAutoKeyframe);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const addKeyframeAtCurrentTime = useDocumentStore((s) => s.addKeyframeAtCurrentTime);
  const togglePropertyStopwatch = useDocumentStore((s) => s.togglePropertyStopwatch);

  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});

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
  const playheadPercent = duration > 0 ? (clampTime(currentTime) / duration) * 100 : 0;

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <button type="button" className={styles.playButton} onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button type="button" className={styles.playButton} onClick={toggleAutoKeyframe}>{autoKeyframe ? 'Auto-Key ON' : 'Auto-Key OFF'}</button>
        <div className={styles.timeReadout}>t={currentTime.toFixed(2)}s · f={frame}</div>
      </div>
      <input
        className={styles.scrubber}
        type="range"
        min={0}
        max={duration}
        step={1 / Math.max(fps, 1)}
        value={clampTime(currentTime)}
        onChange={(e) => setCurrentTime(Number(e.target.value))}
      />
      <div className={styles.tracks}>
        {tracks.map((node) => {
          const expanded = expandedLayers[node.id] ?? true;
          return (
            <div key={node.id} className={styles.trackGroup}>
              <div className={styles.trackRow}>
                <button type="button" className={styles.expandButton} onClick={() => setExpandedLayers((s) => ({ ...s, [node.id]: !expanded }))}>{expanded ? '▾' : '▸'}</button>
                <div className={styles.trackName}>{selectedIds.has(node.id) ? '● ' : ''}{node.name}</div>
                <div className={styles.trackKeys}><span className={styles.playhead} style={{ left: `${playheadPercent}%` }} /></div>
              </div>
              {expanded && PROPERTIES.map((property) => (
                <PropertyRow
                  key={`${node.id}_${property.key}`}
                  node={node}
                  property={property.key}
                  label={property.label}
                  duration={duration}
                  currentTime={currentTime}
                  onSeek={setCurrentTime}
                  onAddKey={() => addKeyframeAtCurrentTime(node.id, property.key, currentTime)}
                  onToggleStopwatch={() => togglePropertyStopwatch(node.id, property.key, currentTime)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PropertyRow({
  node,
  property,
  label,
  duration,
  currentTime,
  onSeek,
  onAddKey,
  onToggleStopwatch,
}: {
  node: SceneNode;
  property: AnimatableProperty;
  label: string;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onAddKey: () => void;
  onToggleStopwatch: () => void;
}) {
  const isAnimated = isPropertyAnimated(node, property);
  const keyframes = node.animation.properties[property].keyframes;

  const navigateKeyframe = (direction: 'prev' | 'next') => {
    if (keyframes.length === 0) return;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const target = direction === 'prev'
      ? [...sorted].reverse().find((k) => k.time < currentTime - 1e-6)
      : sorted.find((k) => k.time > currentTime + 1e-6);
    if (target) onSeek(target.time);
  };

  const currentValue = evaluateNodeAtTime(node, currentTime);
  const display = property === 'opacity'
    ? `${Math.round(currentValue.style.opacity * 100)}%`
    : `${Number(currentValue.transform[property as keyof typeof currentValue.transform]).toFixed(2)}`;

  return (
    <div className={styles.propertyRow}>
      <div className={styles.propertyLabel}>{label}</div>
      <button type="button" className={styles.stopwatchButton} onClick={onToggleStopwatch}>{isAnimated ? '⏱' : '◌'}</button>
      <button type="button" className={styles.miniButton} onClick={() => navigateKeyframe('prev')}>◀</button>
      <button type="button" className={styles.miniButton} onClick={onAddKey}>{hasKeyframeAtTime(node, property, currentTime) ? '◆' : '+'}</button>
      <button type="button" className={styles.miniButton} onClick={() => navigateKeyframe('next')}>▶</button>
      <div className={styles.valueReadout}>{display}</div>
      <div className={styles.trackKeys}>
        {keyframes.map((key) => {
          const left = duration > 0 ? (key.time / duration) * 100 : 0;
          return <span key={`${node.id}_${property}_${key.time}`} className={styles.keyDiamond} style={{ left: `${left}%` }} title={`${key.time.toFixed(2)}s`} />;
        })}
        <span className={styles.playhead} style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
