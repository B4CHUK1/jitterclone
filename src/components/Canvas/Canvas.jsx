// src/components/Canvas/Canvas.jsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer } from 'react-konva'
import useEditorStore from '../../store/editorStore'
import useSceneStore from '../../store/sceneStore'
import CanvasElement from './CanvasElement'
import CanvasBackground from './CanvasBackground'
import { CURSOR_ROTATE } from '../../cursors'

const CANVAS_W = 1280
const CANVAS_H = 720

// Compute the 4 corners of an element in screen-space.
// Also returns the center (average of corners = rotated element's center).
function computeCorners(el, stage) {
  if (!el || !stage) return null

  const x      = el.properties.x.value
  const y      = el.properties.y.value
  const w      = el.properties.width.value
  const h      = el.properties.height.value
  const r      = el.properties.rotation.value * (Math.PI / 180)
  const cos    = Math.cos(r)
  const sin    = Math.sin(r)
  const tf     = stage.getAbsoluteTransform()

  const corners = [
    { cx: 0, cy: 0 },
    { cx: w, cy: 0 },
    { cx: w, cy: h },
    { cx: 0, cy: h },
  ].map(({ cx, cy }) =>
    tf.point({ x: x + cx * cos - cy * sin, y: y + cx * sin + cy * cos }),
  )

  // Center = average of corners (works correctly for any rotation)
  const center = {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  }

  return { corners, center }
}

export default function Canvas() {
  const stageRef    = useRef(null)
  const containerRef = useRef(null)
  const [stageDims, setStageDims] = useState({ w: window.innerWidth, h: window.innerHeight })

  const { selectedId, select, deselect } = useEditorStore()
  const elements       = useSceneStore((s) => s.elements)
  const updateProperties = useSceneStore((s) => s.updateProperties)

  // Map from element id → Konva Image node (populated by CanvasElement via onRegisterRef)
  const elementRefsMap = useRef(new Map())
  const registerRef = useCallback((id, node) => {
    if (node) elementRefsMap.current.set(id, node)
    else       elementRefsMap.current.delete(id)
  }, [])

  // Rotation overlay state
  const [rotInfo, setRotInfo] = useState(null) // { corners, center } in screen-px
  // Incrementing this triggers corner recomputation (after zoom/pan/drag)
  const [stageVersion, setStageVersion] = useState(0)

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null

  // Recompute corners whenever selection, element properties, or stage transform changes
  useEffect(() => {
    if (!selectedEl || !stageRef.current) {
      setRotInfo(null)
      return
    }
    setRotInfo(computeCorners(selectedEl, stageRef.current))
  }, [selectedEl, stageVersion])

  // Fit-to-screen on mount + resize
  useEffect(() => {
    const fitStage = () => {
      if (!stageRef.current || !containerRef.current) return
      const { offsetWidth: W, offsetHeight: H } = containerRef.current
      setStageDims({ w: W, h: H })
      const scale = Math.min(W / CANVAS_W, H / CANVAS_H) * 0.9
      stageRef.current.scale({ x: scale, y: scale })
      stageRef.current.position({
        x: (W - CANVAS_W * scale) / 2,
        y: (H - CANVAS_H * scale) / 2,
      })
      setStageVersion((v) => v + 1)
    }
    const raf = requestAnimationFrame(fitStage)
    const ro = new ResizeObserver(fitStage)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  // Zoom centered on cursor; two-finger scroll → pan
  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()

    if (e.evt.ctrlKey) {
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const scaleBy = 1.06
      const newScale = Math.min(
        Math.max(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.05),
        8,
      )
      stage.scale({ x: newScale, y: newScale })
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      })
    } else {
      stage.position({
        x: stage.x() - e.evt.deltaX,
        y: stage.y() - e.evt.deltaY,
      })
    }
    setStageVersion((v) => v + 1)
  }

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) deselect()
  }

  // ─── Rotation overlay ───────────────────────────────────────────────────────

  const handleRotationStart = useCallback((e, cornerIndex) => {
    e.preventDefault()
    e.stopPropagation()

    const node = elementRefsMap.current.get(selectedId)
    if (!node || !stageRef.current) return

    // Compute the visual center of the element in canvas-space
    // (rotation in Konva is around the node origin, so we derive actual center)
    const r0  = node.rotation() * (Math.PI / 180)
    const cos = Math.cos(r0)
    const sin = Math.sin(r0)
    const centerCanvas = {
      x: node.x() + (node.width() / 2) * cos - (node.height() / 2) * sin,
      y: node.y() + (node.width() / 2) * sin + (node.height() / 2) * cos,
    }
    const centerScreen = stageRef.current.getAbsoluteTransform().point(centerCanvas)

    const startAngle = Math.atan2(
      e.clientY - centerScreen.y,
      e.clientX - centerScreen.x,
    ) * (180 / Math.PI)

    const initialRotation = node.rotation()
    // Snapshot canvas center so "rotate around center" math stays consistent
    const initX = node.x()
    const initY = node.y()
    const W = node.width()
    const H = node.height()

    const onMove = (mv) => {
      const currentAngle = Math.atan2(
        mv.clientY - centerScreen.y,
        mv.clientX - centerScreen.x,
      ) * (180 / Math.PI)

      let newRotation = initialRotation + (currentAngle - startAngle)
      if (mv.shiftKey) newRotation = Math.round(newRotation / 15) * 15

      // Keep visual center fixed while rotating (Figma-style center rotation)
      const newR   = newRotation * (Math.PI / 180)
      const newCos = Math.cos(newR)
      const newSin = Math.sin(newR)
      node.rotation(newRotation)
      node.x(centerCanvas.x - (W / 2) * newCos + (H / 2) * newSin)
      node.y(centerCanvas.y - (W / 2) * newSin - (H / 2) * newCos)
      node.getLayer()?.batchDraw()

      // Keep rotation zones in sync with the moving element
      setStageVersion((v) => v + 1)
    }

    const onUp = () => {
      updateProperties(selectedId, {
        rotation: node.rotation(),
        x:        node.x(),
        y:        node.y(),
      })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
  }, [selectedId, updateProperties])

  // Rotation zones are positioned OUTSIDE the corners so they don't overlap
  // with the Transformer's resize anchors. Direction = outward from center.
  const rotationZones = rotInfo ? rotInfo.corners.map((corner, i) => {
    const { center } = rotInfo
    const dx = corner.x - center.x
    const dy = corner.y - center.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const REACH = 14 // px past the corner where zone center sits
    return {
      x: corner.x + (dx / len) * REACH - 10,
      y: corner.y + (dy / len) * REACH - 10,
      i,
    }
  }) : null

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a', position: 'relative' }}
    >
      <Stage
        ref={stageRef}
        width={stageDims.w}
        height={stageDims.h}
        draggable
        style={{ cursor: 'default' }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDragMove={() => setStageVersion((v) => v + 1)}
        onDragEnd={() => setStageVersion((v) => v + 1)}
      >
        <Layer>
          <CanvasBackground width={CANVAS_W} height={CANVAS_H} onDeselect={deselect} />
          {elements.map((el) => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={selectedId === el.id}
              onSelect={() => select(el.id)}
              onRegisterRef={registerRef}
            />
          ))}
        </Layer>
      </Stage>

      {/* Rotation overlay — HTML divs positioned over the Stage canvas */}
      {rotationZones && rotationZones.map(({ x, y, i }) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top:  y,
            width: 20,
            height: 20,
            cursor: CURSOR_ROTATE[i],
            zIndex: 10,
            // Uncomment to debug zone positions:
            // background: 'rgba(232,255,0,0.15)',
          }}
          onPointerDown={(e) => handleRotationStart(e, i)}
        />
      ))}
    </div>
  )
}
