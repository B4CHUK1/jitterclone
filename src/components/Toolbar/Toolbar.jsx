// src/components/Toolbar/Toolbar.jsx
import { useRef } from 'react'
import useSceneStore from '../../store/sceneStore'
import useEditorStore from '../../store/editorStore'

const CANVAS_W = 1280
const CANVAS_H = 720

function Toolbar() {
  const inputRef = useRef(null)
  const addElement = useSceneStore((s) => s.addElement)
  const select = useEditorStore((s) => s.select)

  function handleImportClick() {
    inputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target.result

      const img = new Image()
      img.onload = () => {
        const naturalWidth = img.naturalWidth
        const naturalHeight = img.naturalHeight

        // Fit within 60% of canvas, preserving aspect ratio
        const MAX_W = CANVAS_W * 0.6
        const MAX_H = CANVAS_H * 0.6
        const ratio = naturalWidth / naturalHeight

        let width, height
        if (naturalWidth / MAX_W > naturalHeight / MAX_H) {
          width  = Math.min(naturalWidth, MAX_W)
          height = width / ratio
        } else {
          height = Math.min(naturalHeight, MAX_H)
          width  = height * ratio
        }

        // Center on canvas
        const x = (CANVAS_W - width) / 2
        const y = (CANVAS_H - height) / 2

        const id = `el_${Date.now()}`

        const element = {
          id,
          type: 'image',
          src,
          naturalWidth,
          naturalHeight,
          fit: 'contain',
          properties: {
            x:        { value: x,      keyframes: [] },
            y:        { value: y,      keyframes: [] },
            width:    { value: width,  keyframes: [] },
            height:   { value: height, keyframes: [] },
            opacity:  { value: 1,      keyframes: [] },
            rotation: { value: 0,      keyframes: [] },
            scale:    { value: 1,      keyframes: [] },
          },
        }

        addElement(element)
        select(id)
      }
      img.src = src
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be re-imported
    e.target.value = ''
  }

  return (
    <div
      style={{
        height: '40px',
        background: '#141414',
        borderBottom: '1px solid #262626',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      {/* Logo / app name */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: '#888888',
          letterSpacing: '0.05em',
          marginRight: '16px',
        }}
      >
        MOCKUP ANIMATOR
      </span>

      <button
        onClick={handleImportClick}
        style={{
          background: 'transparent',
          border: '1px solid #262626',
          color: '#ffffff',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          padding: '4px 10px',
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#e8ff00'
          e.currentTarget.style.color = '#e8ff00'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#262626'
          e.currentTarget.style.color = '#ffffff'
        }}
      >
        IMPORT
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}

export default Toolbar
