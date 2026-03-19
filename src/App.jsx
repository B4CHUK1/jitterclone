// src/App.jsx
import Toolbar from './components/Toolbar/Toolbar'
import Canvas from './components/Canvas/Canvas'
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel'

function App() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
      }}
    >
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Canvas />
        <PropertiesPanel />
      </div>
    </div>
  )
}

export default App
