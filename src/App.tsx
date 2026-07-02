import './theme.css'
import logoUrl from '../assets/logo.svg'
import FileTree from './components/FileTree'
import CanvasView from './components/CanvasView'

export default function App() {
  return (
    <div className="app">
      <div className="titlebar">
        <img src={logoUrl} width={18} height={18} alt="" />
        <span className="name">clipot</span>
      </div>
      <div className="body">
        <aside className="sidebar" data-testid="sidebar"><FileTree /></aside>
        <div className="main">
          <div data-testid="toolbar" style={{ height: 36, background: 'var(--panel)', borderBottom: '1px solid var(--border)' }} />
          <CanvasView />
          <div data-testid="activity-strip" style={{ background: '#140f09', borderTop: '1px solid var(--border)', minHeight: 8 }} />
          <div data-testid="prompt-bar" style={{ background: 'var(--panel)', borderTop: '1px solid var(--border)', minHeight: 44 }} />
        </div>
      </div>
    </div>
  )
}
