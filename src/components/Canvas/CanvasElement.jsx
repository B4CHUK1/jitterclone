// src/components/Canvas/CanvasElement.jsx
import { useRef, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import useSceneStore from '../../store/sceneStore'
import useEditorStore from '../../store/editorStore'

function CanvasElement({ element, isSelected }) {
  const ref = useRef(null)
  const updateProperties = useSceneStore((s) => s.updateProperties)
  const select = useEditorStore((s) => s.select)

  const { id, src, properties } = element
  const x = properties.x.value
  const y = properties.y.value
  const width = properties.width.value
  const height = properties.height.value
  const opacity = properties.opacity.value
  const rotation = properties.rotation.value
  const scale = properties.scale.value

  // Track drag offset locally to avoid re-renders during drag
  const dragStart = useRef({ x: 0, y: 0 })

  const buildTransform = useCallback((px, py, rot, sc) => {
    return `translate(${px}px, ${py}px) rotate(${rot}deg) scale(${sc})`
  }, [])

  const bind = useDrag(
    ({ first, movement: [mx, my], last, event }) => {
      event.stopPropagation()

      if (first) {
        dragStart.current = { x, y }
        select(id)
      }

      const newX = dragStart.current.x + mx
      const newY = dragStart.current.y + my

      // Update DOM directly during drag — no React re-render
      if (ref.current) {
        ref.current.style.transform = buildTransform(newX, newY, rotation, scale)
      }

      if (last) {
        updateProperties(id, { x: newX, y: newY })
      }
    },
    { filterTaps: true }
  )

  return (
    <div
      ref={ref}
      {...bind()}
      onClick={(e) => {
        e.stopPropagation()
        select(id)
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        transform: buildTransform(x, y, rotation, scale),
        opacity,
        outline: isSelected ? '1px solid #e8ff00' : 'none',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          objectFit: 'fill',
        }}
        draggable={false}
      />
    </div>
  )
}

export default CanvasElement
