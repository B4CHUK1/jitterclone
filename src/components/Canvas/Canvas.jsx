// src/components/Canvas/Canvas.jsx
import { useRef, useEffect, useState } from 'react'
import { Stage, Layer } from 'react-konva'
import useEditorStore from '../../store/editorStore'
import useSceneStore from '../../store/sceneStore'
import CanvasElement from './CanvasElement'
import CanvasBackground from './CanvasBackground'

const CANVAS_W = 1280
const CANVAS_H = 720

export default function Canvas() {
  const stageRef = useRef(null)
  const containerRef = useRef(null)
  const [stageDims, setStageDims] = useState({ w: window.innerWidth, h: window.innerHeight })

  const { selectedId, select, deselect } = useEditorStore()
  const elements = useSceneStore((s) => s.elements)

  // Fit-to-screen: set Stage scale + position so canvas fills the container
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
    }

    // Run after first paint so containerRef has dimensions
    const raf = requestAnimationFrame(fitStage)
    const ro = new ResizeObserver(fitStage)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  // Wheel — zoom centered on cursor (Konva official pattern)
  // ctrlKey === true: pinch trackpad or Ctrl+wheel → zoom
  // ctrlKey === false: two-finger trackpad scroll → pan
  const handleWheel = (e) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()

    if (e.evt.ctrlKey) {
      // ZOOM
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }
      // Invert direction for ctrlKey (pinch-to-zoom sends inverted deltaY)
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
      // PAN — two-finger trackpad scroll
      stage.position({
        x: stage.x() - e.evt.deltaX,
        y: stage.y() - e.evt.deltaY,
      })
    }
  }

  // Deselect when clicking directly on Stage (not on any shape)
  const handleStageClick = (e) => {
    if (e.target === e.target.getStage()) {
      deselect()
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', background: '#0a0a0a' }}
    >
      <Stage
        ref={stageRef}
        width={stageDims.w}
        height={stageDims.h}
        draggable
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          <CanvasBackground
            width={CANVAS_W}
            height={CANVAS_H}
            onDeselect={deselect}
          />
          {elements.map((el) => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={selectedId === el.id}
              onSelect={() => select(el.id)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
