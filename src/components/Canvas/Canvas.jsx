// src/components/Canvas/Canvas.jsx
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Stage, Layer } from 'react-konva'
import useEditorStore from '../../store/editorStore'
import useSceneStore from '../../store/sceneStore'
import CanvasElement from './CanvasElement'
import CanvasBackground from './CanvasBackground'
import { CURSOR_ROTATE } from '../../cursors'
import { getElementOverlays } from '../../utils/elementOverlays'

const CANVAS_W = 1280
const CANVAS_H = 720

// ─── Edge resize overlay ──────────────────────────────────────────────────────
// Covers the full length of one edge, rotated to match the element's rotation.
// `side`: 'top' | 'right' | 'bottom' | 'left'
function EdgeOverlay({ side, overlays, onPointerDown }) {
  const { tl, tr, br, bl, angleDeg, sWidth, sHeight } = overlays

  // Midpoint of the edge in screen-space
  const mid = {
    top:    { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 },
    right:  { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 },
    bottom: { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 },
    left:   { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 },
  }[side]

  // Edge length in screen-space
  const edgeLen = { top: sWidth, right: sHeight, bottom: sWidth, left: sHeight }[side]

  // Thickness of the hit area
  const THICKNESS = 12

  // CSS cursor
  const cursorMap = {
    top:    'ns-resize',
    bottom: 'ns-resize',
    left:   'ew-resize',
    right:  'ew-resize',
  }

  return (
    <div
      style={{
        position:        'absolute',
        left:            mid.x - edgeLen / 2,
        top:             mid.y - THICKNESS / 2,
        width:           edgeLen,
        height:          THICKNESS,
        transform:       `rotate(${angleDeg}deg)`,
        transformOrigin: 'center center',
        cursor:          cursorMap[side],
        zIndex:          10,
        // Uncomment to debug: background: 'rgba(0,200,255,0.2)',
      }}
      onPointerDown={(e) => onPointerDown(e, side)}
    />
  )
}

// ─── Corner rotation overlay ───────────────────────────────────────────────────
// 20×20 div positioned OUTSIDE the corner, radially from center.
function CornerRotateOverlay({ corner, overlays, onPointerDown, cursorIndex }) {
  const { tl, tr, br, bl, center } = overlays
  const pts = { tl, tr, br, bl }
  const pt = pts[corner]
  const dx = pt.x - center.x
  const dy = pt.y - center.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const REACH = 14
  const x = pt.x + (dx / len) * REACH - 10
  const y = pt.y + (dy / len) * REACH - 10

  return (
    <div
      style={{
        position: 'absolute',
        left:     x,
        top:      y,
        width:    20,
        height:   20,
        cursor:   CURSOR_ROTATE[cursorIndex],
        zIndex:   11,
        // Uncomment to debug: background: 'rgba(232,255,0,0.15)',
      }}
      onPointerDown={(e) => onPointerDown(e, cursorIndex)}
    />
  )
}

export default function Canvas() {
  const stageRef     = useRef(null)
  const containerRef = useRef(null)
  const [stageDims, setStageDims] = useState({ w: window.innerWidth, h: window.innerHeight })

  const { selectedId, select, deselect } = useEditorStore()
  const elements         = useSceneStore((s) => s.elements)
  const updateProperties = useSceneStore((s) => s.updateProperties)

  // Map from element id → Konva Image node (populated by CanvasElement via onRegisterRef)
  const elementRefsMap = useRef(new Map())
  const registerRef = useCallback((id, node) => {
    if (node) elementRefsMap.current.set(id, node)
    else       elementRefsMap.current.delete(id)
  }, [])

  // Incrementing this triggers overlay recomputation (after zoom/pan/drag)
  const [stageVersion, setStageVersion] = useState(0)

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null

  // Compute all overlay positions whenever selection, element properties, or stage transform changes
  const overlays = useMemo(() => {
    if (!selectedEl || !stageRef.current) return null
    return getElementOverlays(selectedEl, stageRef.current)
    // stageVersion is the dependency that captures zoom/pan/drag changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ─── Rotation drag ────────────────────────────────────────────────────────────

  const handleRotationStart = useCallback((e, cornerIndex) => {
    e.preventDefault()
    e.stopPropagation()

    const node = elementRefsMap.current.get(selectedId)
    if (!node || !stageRef.current) return

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
    const W = node.width()
    const H = node.height()

    const onMove = (mv) => {
      const currentAngle = Math.atan2(
        mv.clientY - centerScreen.y,
        mv.clientX - centerScreen.x,
      ) * (180 / Math.PI)

      let newRotation = initialRotation + (currentAngle - startAngle)
      if (mv.shiftKey) newRotation = Math.round(newRotation / 15) * 15

      const newR   = newRotation * (Math.PI / 180)
      const newCos = Math.cos(newR)
      const newSin = Math.sin(newR)
      node.rotation(newRotation)
      node.x(centerCanvas.x - (W / 2) * newCos + (H / 2) * newSin)
      node.y(centerCanvas.y - (W / 2) * newSin - (H / 2) * newCos)
      node.getLayer()?.batchDraw()
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

  // ─── Edge resize drag ─────────────────────────────────────────────────────────

  const handleEdgeResizeStart = useCallback((e, side) => {
    e.preventDefault()
    e.stopPropagation()

    const node = elementRefsMap.current.get(selectedId)
    if (!node || !stageRef.current) return

    const stage = stageRef.current
    const scale = stage.scaleX()
    const r     = node.rotation() * (Math.PI / 180)
    const cos   = Math.cos(r)
    const sin   = Math.sin(r)

    // Snapshot initial state (absolute — avoids cumulative floating-point drift)
    const init = {
      x:      node.x(),
      y:      node.y(),
      width:  node.width(),
      height: node.height(),
      mouseX: e.clientX,
      mouseY: e.clientY,
    }

    const onMove = (mv) => {
      // Delta from drag-start in canvas-space
      const dx = (mv.clientX - init.mouseX) / scale
      const dy = (mv.clientY - init.mouseY) / scale

      // Unit vectors of the element's local axes in world-space
      const axisH_x =  cos  // "right" direction
      const axisH_y =  sin
      const axisV_x = -sin  // "down" direction
      const axisV_y =  cos

      // Project mouse delta onto each local axis
      const localH = dx * axisH_x + dy * axisH_y
      const localV = dx * axisV_x + dy * axisV_y

      let newX      = init.x
      let newY      = init.y
      let newWidth  = init.width
      let newHeight = init.height

      if (side === 'right') {
        newWidth = Math.max(20, init.width + localH)
      } else if (side === 'left') {
        newWidth = Math.max(20, init.width - localH)
        const delta = init.width - newWidth
        newX = init.x + delta * axisH_x
        newY = init.y + delta * axisH_y
      } else if (side === 'bottom') {
        newHeight = Math.max(20, init.height + localV)
      } else if (side === 'top') {
        newHeight = Math.max(20, init.height - localV)
        const delta = init.height - newHeight
        newX = init.x + delta * axisV_x
        newY = init.y + delta * axisV_y
      }

      node.x(newX)
      node.y(newY)
      node.width(newWidth)
      node.height(newHeight)
      node.getLayer()?.batchDraw()
      setStageVersion((v) => v + 1)
    }

    const onUp = () => {
      updateProperties(selectedId, {
        x:      node.x(),
        y:      node.y(),
        width:  node.width(),
        height: node.height(),
      })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
  }, [selectedId, updateProperties])

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

      {/* HTML overlays — edge resize + corner rotation — positioned over Stage canvas */}
      {overlays && (
        <>
          {['top', 'right', 'bottom', 'left'].map((side) => (
            <EdgeOverlay
              key={side}
              side={side}
              overlays={overlays}
              onPointerDown={handleEdgeResizeStart}
            />
          ))}
          {[['tl', 0], ['tr', 1], ['br', 2], ['bl', 3]].map(([corner, idx]) => (
            <CornerRotateOverlay
              key={corner}
              corner={corner}
              overlays={overlays}
              onPointerDown={handleRotationStart}
              cursorIndex={idx}
            />
          ))}
        </>
      )}
    </div>
  )
}
