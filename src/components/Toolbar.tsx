import { Undo2, Redo2, Copy, ScanLine, Minus, Plus, ListChecks, Settings } from 'lucide-react'
import { useStore } from '@/store/store'

type Props = { onOpenRules: () => void; onOpenSettings: () => void }

export default function Toolbar({ onOpenRules, onOpenSettings }: Props) {
  const { undo, redo, duplicate, canUndo, canRedo, regionMode, toggleRegionMode, zoom, zoomIn, zoomOut, zoomReset } = useStore()

  return (
    <div data-testid="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
      <button onClick={undo} disabled={!canUndo()} title="Undo"><Undo2 size={15} /></button>
      <button onClick={redo} disabled={!canRedo()} title="Redo"><Redo2 size={15} /></button>
      <button onClick={() => void duplicate()} title="Duplicate file"><Copy size={15} /></button>
      <button className={regionMode ? 'active' : ''} onClick={toggleRegionMode} title="Region select — drag a box to select multiple elements">
        <ScanLine size={15} />
      </button>
      <button onClick={zoomOut} disabled={zoom <= 0.25} title="Zoom out (Ctrl/Cmd −)"><Minus size={15} /></button>
      <button onClick={zoomReset} title="Reset zoom (Ctrl/Cmd 0)" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 46, justifyContent: 'center' }}>
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={zoomIn} disabled={zoom >= 4} title="Zoom in (Ctrl/Cmd +)"><Plus size={15} /></button>
      <div style={{ flex: 1 }} />
      <button onClick={onOpenRules} title="Edit rules"><ListChecks size={15} /></button>
      <button onClick={onOpenSettings} title="Settings"><Settings size={15} /></button>
    </div>
  )
}
