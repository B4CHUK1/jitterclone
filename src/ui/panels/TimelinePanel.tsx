import { useMemo } from 'react';
import { useDocumentStore, useEditorStore, useTimelineStore } from '@/state';
import styles from './TimelinePanel.module.css';

export function TimelinePanel() {
  const document = useDocumentStore((s) => s.document);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const togglePlay = useTimelineStore((s) => s.togglePlay);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  const { duration, fps } = document.composition;
  const frame = Math.round(currentTime * fps);

  const tracks = useMemo(
    () =>
      document.rootNodeIds
        .map((id) => document.nodes[id])
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    [document],
  );

  return (
    <div className={styles.timeline}>
      <div className={styles.header}>
        <button type="button" className={styles.playButton} onClick={togglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className={styles.timeReadout}>t={currentTime.toFixed(2)}s · f={frame}</div>
      </div>
      <input
        className={styles.scrubber}
        type="range"
        min={0}
        max={duration}
        step={1 / Math.max(fps, 1)}
        value={Math.min(currentTime, duration)}
        onChange={(e) => setCurrentTime(Number(e.target.value))}
      />
      <div className={styles.tracks}>
        {tracks.map((node) => (
          <div key={node.id} className={styles.trackRow}>
            <div className={styles.trackName}>
              {selectedIds.has(node.id) ? '● ' : ''}
              {node.name}
            </div>
            <div className={styles.trackKeys}>
              {Object.values(node.animation.tracks)
                .flat()
                .map((key, index) => (
                  <span
                    key={`${node.id}_${index}_${key.time}`}
                    className={styles.keyDot}
                    style={{ left: `${(key.time / duration) * 100}%` }}
                    title={`${key.time.toFixed(2)}s`}
                  />
                ))}
              <span className={styles.playhead} style={{ left: `${(Math.min(currentTime, duration) / duration) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
