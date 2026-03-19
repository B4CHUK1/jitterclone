import { createPortal } from 'react-dom';
import type { Vec2 } from '@/engine/transform';
import styles from './RotateTooltipOverlay.module.css';

export interface RotateTooltipData {
  client: Vec2;
  angle: number;
  snapped: boolean;
}

interface RotateTooltipOverlayProps {
  tooltip: RotateTooltipData | null;
}

export function RotateTooltipOverlay({ tooltip }: RotateTooltipOverlayProps) {
  if (!tooltip) return null;

  return createPortal(
    <div
      className={styles.tooltip}
      style={{
        left: tooltip.client.x + 12,
        top: tooltip.client.y + 12,
      }}
    >
      {formatAngle(tooltip.angle)}
      {tooltip.snapped ? ' • snap' : ''}
    </div>,
    document.body,
  );
}

function formatAngle(angle: number): string {
  const rounded = Math.round(angle * 10) / 10;
  return `${rounded}°`;
}
