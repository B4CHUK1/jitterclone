// src/components/Canvas/Canvas.jsx
import { useRef, useEffect, useState } from 'react'
import useSceneStore from '../../store/sceneStore'
import useEditorStore from '../../store/editorStore'
import CanvasElement from './CanvasElement'

const CANVAS_W = 1280
const CANVAS_H = 720

function Canvas() {
  const elements = useSceneStore((s) => s.elements)
  const selectedId = useEditorStore((s) => s.selectedId)
  const deselect = useEditorStore((s) => s.deselect)

  const [scale, setScale] = useState(1)
  const containerRef = useRef(null)

  useEffect(() => {
    function computeScale() {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      // 32px padding on each side
      const scaleX = (clientWidth - 64) / CANVAS_W
      const scaleY = (clientHeight - 64) / CANVAS_H
      setScale(Math.min(scaleX, scaleY, 1))
    }

    computeScale()
    const ro = new ResizeObserver(computeScale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
      onClick={deselect}
    >
      {/* Scale wrapper */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
        }}
      >
        {/* Canvas surface */}
        <div
          style={{
            position: 'relative',
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            background: '#111111',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            // Deselect only when clicking directly on canvas bg (not on element)
            if (e.target === e.currentTarget) deselect()
          }}
        >
          {elements.map((el) => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={selectedId === el.id}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Canvas
