import type { Vec2 } from '@/engine/transform';
import type { SnapGuide } from '@/engine/interaction/snapEngine';
import styles from './SnapOverlay.module.css';

interface SnapOverlayProps {
  guides: SnapGuide[];
  worldToScreen: (p: Vec2) => Vec2;
}

export function SnapOverlay({ guides, worldToScreen }: SnapOverlayProps) {
  return (
    <div className={styles.overlay}>
      {guides.map((guide, idx) => {
        if (guide.axis === 'x') {
          const start = worldToScreen({ x: guide.value, y: guide.from });
          const end = worldToScreen({ x: guide.value, y: guide.to });
          return (
            <div
              key={`${guide.axis}-${guide.value}-${idx}`}
              className={[
                styles.guideLine,
                guide.source === 'canvas' ? styles.canvasGuide : styles.objectGuide,
                guide.kind === 'center' ? styles.centerGuide : styles.edgeGuide,
              ].join(' ')}
              style={{
                left: start.x,
                top: Math.min(start.y, end.y),
                width: 1,
                height: Math.abs(end.y - start.y),
              }}
            />
          );
        }

        const start = worldToScreen({ x: guide.from, y: guide.value });
        const end = worldToScreen({ x: guide.to, y: guide.value });
        return (
          <div
            key={`${guide.axis}-${guide.value}-${idx}`}
            className={[
              styles.guideLine,
              guide.source === 'canvas' ? styles.canvasGuide : styles.objectGuide,
              guide.kind === 'center' ? styles.centerGuide : styles.edgeGuide,
            ].join(' ')}
            style={{
              left: Math.min(start.x, end.x),
              top: start.y,
              width: Math.abs(end.x - start.x),
              height: 1,
            }}
          />
        );
      })}

    </div>
  );
}
