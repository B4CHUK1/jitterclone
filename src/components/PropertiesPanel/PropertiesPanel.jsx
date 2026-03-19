// src/components/PropertiesPanel/PropertiesPanel.jsx
import useSceneStore from '../../store/sceneStore'
import useEditorStore from '../../store/editorStore'

const labelStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: '#888888',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '4px',
  display: 'block',
}

const rowStyle = {
  display: 'flex',
  gap: '8px',
  marginBottom: '12px',
}

const fieldStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
}

function Field({ label, children }) {
  return (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  )
}

function NumInput({ value, onChange }) {
  return (
    <input
      type="number"
      value={Math.round(value)}
      onChange={(e) => {
        const v = parseFloat(e.target.value)
        if (!isNaN(v)) onChange(v)
      }}
      className="prop-number"
    />
  )
}

function PropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedId)
  const elements = useSceneStore((s) => s.elements)
  const updateProperty = useSceneStore((s) => s.updateProperty)

  const element = selectedId ? elements.find((e) => e.id === selectedId) : null

  if (!element) {
    return (
      <div style={panelStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333333',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
          }}
        >
          No selection
        </div>
      </div>
    )
  }

  const { properties, id } = element
  const set = (prop, value) => updateProperty(id, prop, value)

  const opacityPercent = Math.round(properties.opacity.value * 100)

  return (
    <div style={panelStyle}>
      <div style={sectionStyle}>
        {/* X / Y */}
        <div style={rowStyle}>
          <Field label="X">
            <NumInput value={properties.x.value} onChange={(v) => set('x', v)} />
          </Field>
          <Field label="Y">
            <NumInput value={properties.y.value} onChange={(v) => set('y', v)} />
          </Field>
        </div>

        {/* W / H */}
        <div style={rowStyle}>
          <Field label="W">
            <NumInput value={properties.width.value} onChange={(v) => set('width', Math.max(1, v))} />
          </Field>
          <Field label="H">
            <NumInput value={properties.height.value} onChange={(v) => set('height', Math.max(1, v))} />
          </Field>
        </div>

        {/* Opacity */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <span style={labelStyle}>Opacity</span>
            <span style={{ ...labelStyle, color: '#ffffff', marginBottom: 0 }}>{opacityPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={opacityPercent}
            onChange={(e) => set('opacity', parseInt(e.target.value, 10) / 100)}
            className="prop-slider"
          />
        </div>

        {/* Rotation */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <span style={labelStyle}>Rotation</span>
            <span style={{ ...labelStyle, color: '#ffffff', marginBottom: 0 }}>{Math.round(properties.rotation.value)}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            value={properties.rotation.value}
            onChange={(e) => set('rotation', parseInt(e.target.value, 10))}
            className="prop-slider"
          />
        </div>
      </div>
    </div>
  )
}

const panelStyle = {
  width: '240px',
  flexShrink: 0,
  background: '#141414',
  borderLeft: '1px solid #262626',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const sectionStyle = {
  padding: '16px 12px',
}

export default PropertiesPanel
