// src/components/Canvas/Canvas.jsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import useSceneStore from '../../store/sceneStore'
import useEditorStore from '../../store/editorStore'
import CanvasElement from './CanvasElement'

const CANVAS_W = 1280
const CANVAS_H = 720

function Canvas() {
  const elements = useSceneStore((s) => s.elements)
  const selectedId = useEditorStore((s) => s.selectedId)
  const deselect = useEditorStore((s) => s.deselect)
  const zoom = useEditorStore((s) => s.zoom)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setPan = useEditorStore((s) => s.setPan)
  const resetView = useEditorStore((s) => s.resetView)

  const [baseScale, setBaseScale] = useState(1)
  const [spaceCursor, setSpaceCursor] = useState(false)

  const containerRef = useRef(null)
  const spacePressed = useRef(false)
  const panStartRef = useRef({ panX: 0, panY: 0 })

  // Fit-to-screen base scale via ResizeObserver
  useEffect(() => {
    function computeScale() {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      const sx = (clientWidth - 64) / CANVAS_W
      const sy = (clientHeight - 64) / CANVAS_H
      setBaseScale(Math.min(sx, sy, 1))
    }
    computeScale()
    const ro = new ResizeObserver(computeScale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Space key for pan cursor (state for re-render) + ref for drag logic (no re-render)
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        spacePressed.current = true
        setSpaceCursor(true)
      }
    }
    function onKeyUp(e) {
      if (e.code === 'Space') {
        spacePressed.current = false
        setSpaceCursor(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Wheel: non-passive so we can call preventDefault.
  // ctrlKey === true signals pinch-to-zoom (trackpad) or Ctrl+wheel → ZOOM.
  // No ctrlKey = two-finger scroll on trackpad → PAN.
  const handleWheel = useCallback((e) => {
    e.preventDefault()

    const { zoom: curZoom, panX: curPanX, panY: curPanY } = useEditorStore.getState()

    if (e.ctrlKey) {
      // ZOOM — centered on mouse cursor position
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      const newZoom = Math.min(Math.max(curZoom * factor, 0.1), 4)

      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - rect.width  / 2
      const mouseY = e.clientY - rect.top  - rect.height / 2
      const scaleFactor = newZoom / curZoom
      const newPanX = mouseX - scaleFactor * (mouseX - curPanX)
      const newPanY = mouseY - scaleFactor * (mouseY - curPanY)

      setZoom(newZoom)
      setPan(newPanX, newPanY)
    } else {
      // PAN — two-finger trackpad scroll
      setPan(curPanX - e.deltaX, curPanY - e.deltaY)
    }
  }, [setZoom, setPan])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Pan via Space + drag
  const panBind = useDrag(({ first, movement: [mx, my] }) => {
    if (!spacePressed.current) return
    if (first) {
      const s = useEditorStore.getState()
      panStartRef.current = { panX: s.panX, panY: s.panY }
    }
    setPan(panStartRef.current.panX + mx, panStartRef.current.panY + my)
  })

  const totalZoom = baseScale * zoom

  return (
    <div
      ref={containerRef}
      {...panBind()}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        overflow: 'hidden',
        cursor: spaceCursor ? 'grab' : 'default',
      }}
      onClick={deselect}
    >
      {/* Pan + zoom wrapper */}
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${totalZoom})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        {/* Canvas surface — 1280×720 */}
        <div
          style={{
            position: 'relative',
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            background: '#111111',
            overflow: 'hidden',
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) deselect()
          }}
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) resetView()
          }}
        >
          {elements.map((el) => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={selectedId === el.id}
              totalZoom={totalZoom}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Canvas
