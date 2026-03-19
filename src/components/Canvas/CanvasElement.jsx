// src/components/Canvas/CanvasElement.jsx
import { useRef, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'
import useSceneStore from '../../store/sceneStore'
import useEditorStore from '../../store/editorStore'

const HANDLE_SIZE = 8

const HANDLES = [
  { id: 'nw', top: 0,   left: 0,   cursor: 'nw-resize' },
  { id: 'n',  top: 0,   left: 50,  cursor: 'n-resize'  },
  { id: 'ne', top: 0,   left: 100, cursor: 'ne-resize' },
  { id: 'e',  top: 50,  left: 100, cursor: 'e-resize'  },
  { id: 'se', top: 100, left: 100, cursor: 'se-resize' },
  { id: 's',  top: 100, left: 50,  cursor: 's-resize'  },
  { id: 'sw', top: 100, left: 0,   cursor: 'sw-resize' },
  { id: 'w',  top: 50,  left: 0,   cursor: 'w-resize'  },
]

function applyHandleDelta(handleId, initial, dx, dy) {
  let { x, y, width, height } = initial
  const MIN = 20

  switch (handleId) {
    case 'se':
      width  = Math.max(MIN, initial.width  + dx)
      height = Math.max(MIN, initial.height + dy)
      break
    case 'sw':
      width  = Math.max(MIN, initial.width  - dx)
      x      = initial.x + Math.min(dx, initial.width  - MIN)
      height = Math.max(MIN, initial.height + dy)
      break
    case 'ne':
      width  = Math.max(MIN, initial.width  + dx)
      height = Math.max(MIN, initial.height - dy)
      y      = initial.y + Math.min(dy, initial.height - MIN)
      break
    case 'nw':
      width  = Math.max(MIN, initial.width  - dx)
      x      = initial.x + Math.min(dx, initial.width  - MIN)
      height = Math.max(MIN, initial.height - dy)
      y      = initial.y + Math.min(dy, initial.height - MIN)
      break
    case 'e':
      width  = Math.max(MIN, initial.width  + dx)
      break
    case 'w':
      width  = Math.max(MIN, initial.width  - dx)
      x      = initial.x + Math.min(dx, initial.width  - MIN)
      break
    case 's':
      height = Math.max(MIN, initial.height + dy)
      break
    case 'n':
      height = Math.max(MIN, initial.height - dy)
      y      = initial.y + Math.min(dy, initial.height - MIN)
      break
    default:
      break
  }

  return { x, y, width, height }
}

// Module-level component — stable hooks, one per handle instance
function ResizeHandle({ handleId, cursor, posTop, posLeft, elementRef, currentState, totalZoom, elementId, updateProperties, buildTransform }) {
  const initial = useRef(null)

  const bindHandle = useDrag(({ first, movement: [mx, my], last }) => {
    if (first) {
      initial.current = { ...currentState.current }
    }

    const inv = 1 / totalZoom
    const { x, y, width, height } = applyHandleDelta(
      handleId,
      initial.current,
      mx * inv,
      my * inv,
    )

    if (elementRef.current) {
      elementRef.current.style.width = `${width}px`
      elementRef.current.style.height = `${height}px`
      elementRef.current.style.transform = buildTransform(x, y, initial.current.rotation, initial.current.scale)
    }

    if (last) {
      updateProperties(elementId, { x, y, width, height })
    }
  }, { filterTaps: true })

  // Merge gesture handler with stopPropagation so the element's drag doesn't also start
  const gestureHandlers = bindHandle()

  return (
    <div
      {...gestureHandlers}
      onPointerDown={(e) => {
        e.stopPropagation()
        gestureHandlers.onPointerDown?.(e)
      }}
      style={{
        position: 'absolute',
        top: `${posTop}%`,
        left: `${posLeft}%`,
        transform: 'translate(-50%, -50%)',
        width: `${HANDLE_SIZE}px`,
        height: `${HANDLE_SIZE}px`,
        background: '#0a0a0a',
        border: '1px solid #e8ff00',
        cursor,
        zIndex: 10,
        touchAction: 'none',
        flexShrink: 0,
      }}
    />
  )
}

function CanvasElement({ element, isSelected, totalZoom }) {
  const ref = useRef(null)
  const updateProperties = useSceneStore((s) => s.updateProperties)
  const select = useEditorStore((s) => s.select)

  const { id, src, naturalWidth, naturalHeight, fit = 'contain', properties } = element
  const x        = properties.x.value
  const y        = properties.y.value
  const width    = properties.width.value
  const height   = properties.height.value
  const opacity  = properties.opacity.value
  const rotation = properties.rotation.value
  const scale    = properties.scale.value

  // Always-current snapshot — handles capture this on drag start
  const currentState = useRef({ x, y, width, height, rotation, scale })
  currentState.current = { x, y, width, height, rotation, scale }

  const dragStart = useRef({ x: 0, y: 0 })

  const buildTransform = useCallback((px, py, rot, sc) => {
    return `translate(${px}px, ${py}px) rotate(${rot}deg) scale(${sc})`
  }, [])

  // DO NOT override onPointerDown after spreading bind() — that breaks the gesture.
  // The canvas background uses e.target === e.currentTarget for deselect, so no
  // explicit stopPropagation is needed here.
  const bind = useDrag(
    ({ first, movement: [mx, my], last, event }) => {
      event.stopPropagation()

      if (first) {
        dragStart.current = { x, y }
        select(id)
      }

      const inv = 1 / totalZoom
      const newX = dragStart.current.x + mx * inv
      const newY = dragStart.current.y + my * inv

      if (ref.current) {
        ref.current.style.transform = buildTransform(newX, newY, rotation, scale)
      }

      if (last) {
        updateProperties(id, { x: newX, y: newY })
      }
    },
    { filterTaps: true },
  )

  // Image rendering based on fit mode
  const imgStyle = {
    display: 'block',
    pointerEvents: 'none',
    objectPosition: 'center',
    ...(fit === 'crop'
      ? { width: `${naturalWidth}px`, height: `${naturalHeight}px`, objectFit: 'none' }
      : { width: '100%', height: '100%', objectFit: fit }),
  }

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
      {/* Inner wrapper handles overflow:hidden for crop mode */}
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: fit === 'crop' ? 'hidden' : 'visible',
          position: 'relative',
        }}
      >
        <img
          src={src}
          alt=""
          style={imgStyle}
          draggable={false}
        />
      </div>

      {isSelected && HANDLES.map((h) => (
        <ResizeHandle
          key={h.id}
          handleId={h.id}
          cursor={h.cursor}
          posTop={h.top}
          posLeft={h.left}
          elementRef={ref}
          currentState={currentState}
          totalZoom={totalZoom}
          elementId={id}
          updateProperties={updateProperties}
          buildTransform={buildTransform}
        />
      ))}
    </div>
  )
}

export default CanvasElement
