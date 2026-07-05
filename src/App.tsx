import { useState, useEffect } from 'react'
import './theme.css'
import { useStore } from '@/store/store'
import FileTree from './components/FileTree'
import CanvasView from './components/CanvasView'
import NewFileView from './components/NewFileView'
import Placeholder from './components/Placeholder'
import Toolbar from './components/Toolbar'
import ActivityStrip from './components/ActivityStrip'
import PromptBar from './components/PromptBar'
import ThreadDrawer from './components/ThreadDrawer'
import SettingsModal from './components/SettingsModal'
import RulesEditor from './components/RulesEditor'
import PromptHost from './components/PromptHost'
import TitleBar from './components/TitleBar'
import { mainView } from '@/lib/mainView'

export default function App() {
  const { mode, startNewFile, folder, activePath, tree, openFolder } = useStore()
  const view = mainView({ folder, mode, activePath, tree })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  // Restore last session (provider/model + last folder and active file) on launch.
  useEffect(() => { void useStore.getState().init() }, [])

  return (
    <div className="app">
      <TitleBar onNewFile={startNewFile} />
      <div className="body">
        <aside className="sidebar" data-testid="sidebar"><FileTree /></aside>
        <div className="main">
          <Toolbar onOpenRules={() => setRulesOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
          {view === 'no-folder' && (
            <Placeholder message="No folder open." actionLabel="Open folder" onAction={openFolder} />
          )}
          {(view === 'new' || view === 'empty-folder') && <NewFileView />}
          {view === 'no-file' && (
            <Placeholder message="Select a file from the sidebar, or press + to create a new one." />
          )}
          {view === 'canvas' && <CanvasView />}
          <ActivityStrip />
          {view === 'canvas' && <PromptBar />}
        </div>
      </div>
      <ThreadDrawer />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesEditor open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <PromptHost />
    </div>
  )
}
