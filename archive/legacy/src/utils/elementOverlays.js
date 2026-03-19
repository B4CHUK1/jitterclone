// src/utils/elementOverlays.js
// Computes screen-space overlay positions for a selected canvas element.
// Used to render HTML edge-resize divs and corner-rotation divs on top of the Konva stage.

export function getElementOverlays(element, stage) {
  if (!element || !stage) return null

  const x        = element.properties.x.value
  const y        = element.properties.y.value
  const width    = element.properties.width.value
  const height   = element.properties.height.value
  const angleDeg = element.properties.rotation.value
  const r        = angleDeg * (Math.PI / 180)
  const cos      = Math.cos(r)
  const sin      = Math.sin(r)
  const tf       = stage.getAbsoluteTransform()

  // Convert a canvas-space offset (cx, cy) from the element origin to screen coords
  const toScreen = (cx, cy) =>
    tf.point({ x: x + cx * cos - cy * sin, y: y + cx * sin + cy * cos })

  const tl     = toScreen(0,     0)
  const tr     = toScreen(width, 0)
  const br     = toScreen(width, height)
  const bl     = toScreen(0,     height)
  const center = toScreen(width / 2, height / 2)

  const scale   = stage.scaleX()
  const sWidth  = width  * scale
  const sHeight = height * scale

  return { tl, tr, br, bl, center, angleDeg, sWidth, sHeight, scale }
}
