// src/components/App.jsx
import Toolbar from './components/Toolbar/Toolbar'
import Canvas from './components/Canvas/Canvas'

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
      <Canvas />
    </div>
  )
}

export default App
