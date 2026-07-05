import { useState, useEffect } from 'react'
import './theme.css'
import logoUrl from '../assets/logo.svg'
import { Plus } from 'lucide-react'
import { useStore } from '@/store/store'
import FileTree from './components/FileTree'
import CanvasView from './components/CanvasView'
import NewFileView from './components/NewFileView'
import Toolbar from './components/Toolbar'
import ActivityStrip from './components/ActivityStrip'
import PromptBar from './components/PromptBar'
import ThreadDrawer from './components/ThreadDrawer'
import SettingsModal from './components/SettingsModal'
import RulesEditor from './components/RulesEditor'

export default function App() {
  const { mode, startNewFile } = useStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  // Restore last session (provider/model + last folder and active file) on launch.
  useEffect(() => { void useStore.getState().init() }, [])

  return (
    <div className="app">
      <div className="titlebar">
        <img src={logoUrl} width={18} height={18} alt="" />
        <span className="name">clipot</span>
        <div style={{ flex: 1 }} />
        <button onClick={startNewFile} title="New SVG" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          <Plus size={16} />
        </button>
      </div>
      <div className="body">
        <aside className="sidebar" data-testid="sidebar"><FileTree /></aside>
        <div className="main">
          <Toolbar onOpenRules={() => setRulesOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
          {mode === 'new' ? <NewFileView /> : <CanvasView />}
          <ActivityStrip />
          {mode !== 'new' && <PromptBar />}
        </div>
      </div>
      <ThreadDrawer />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesEditor open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
