// src/cursors.js
// All custom SVG cursor data URLs used across the canvas.
// Each exports a ready-to-use CSS cursor string.

const toDataURL = (svg) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

// ── Move (4-arrow cross) ─────────────────────────────────────────────────────
export const CURSOR_MOVE = toDataURL(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<filter id="s"><feDropShadow dx="0" dy="0" stdDeviation="1" flood-color="#000" flood-opacity="0.4"/></filter>` +
  `<g filter="url(#s)" fill="white" stroke="white" stroke-width="0.5">` +
  `<path d="M12 3l-3 3h2v3H8V7l-3 3 3 3v-2h3v3H9l3 3 3-3h-2v-3h3v2l3-3-3-3v2h-3V6h2z"/>` +
  `</g></svg>`,
) + ' 12 12, move'

// ── Grab (open hand) ─────────────────────────────────────────────────────────
export const CURSOR_GRAB = toDataURL(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.4"/></filter>` +
  `<g filter="url(#s)" fill="white">` +
  `<path d="M9 4.5a1 1 0 0 1 2 0V11a1 1 0 0 1 2 0V8.5a1 1 0 0 1 2 0v2a1 1 0 0 1 2 0v4a5 5 0 0 1-5 5h-1A5 5 0 0 1 6 15v-3.5l-1-3a1 1 0 0 1 1.9-.7l.6 1.7V4.5z"/>` +
  `</g></svg>`,
) + ' 9 4, grab'

// ── Grabbing (closed hand) ───────────────────────────────────────────────────
export const CURSOR_GRABBING = toDataURL(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.4"/></filter>` +
  `<g filter="url(#s)" fill="white">` +
  `<path d="M7 9.5a1 1 0 0 1 2 0v1a1 1 0 0 1 2 0v-.5a1 1 0 0 1 2 0v.5a1 1 0 0 1 2 0v2a5 5 0 0 1-5 5h-1A5 5 0 0 1 4 13v-2a1 1 0 0 1 2 0v1a1 1 0 0 1 1-.5z"/>` +
  `</g></svg>`,
) + ' 9 9, grabbing'

// ── Rotation cursors — one per corner, arrow oriented for that corner ────────
// rotate(deg) spins the arc+arrow around the SVG center (12,12)
const rotateArrow = (deg) => toDataURL(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity="0.4"/></filter>` +
  `<g filter="url(#s)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${deg} 12 12)">` +
  `<path d="M4 8a8 8 0 0 1 14.5-2"/>` +
  `<polyline points="18 2 20.5 6 16 6"/>` +
  `</g></svg>`,
) + ' 12 12, crosshair'

// Index matches corner order in Canvas.jsx: 0=TL, 1=TR, 2=BR, 3=BL
export const CURSOR_ROTATE = [
  rotateArrow(135), // top-left
  rotateArrow(225), // top-right
  rotateArrow(315), // bottom-right
  rotateArrow(45),  // bottom-left
]

// ── Native CSS resize cursors (used by Konva Transformer edges via Konva) ────
export const CURSOR_RESIZE = {
  n:  'n-resize',
  s:  's-resize',
  e:  'e-resize',
  w:  'w-resize',
  nw: 'nw-resize',
  ne: 'ne-resize',
  se: 'se-resize',
  sw: 'sw-resize',
}
