// src/components/Canvas/CanvasBackground.jsx
// Rect filling the 1280×720 canvas area.
// Required so Konva can detect clicks on the canvas background
// (an empty Stage receives no pointer events — only its shapes do).
import { Rect } from 'react-konva'

export default function CanvasBackground({ width, height, onDeselect }) {
  return (
    <Rect
      x={0}
      y={0}
      width={width}
      height={height}
      fill="#111111"
      onClick={onDeselect}
      onTap={onDeselect}
    />
  )
}
