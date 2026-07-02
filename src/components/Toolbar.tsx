import { Undo2, Redo2, Copy, ScanLine, ListChecks, Settings } from 'lucide-react'
import { useStore } from '@/store/store'

type Props = { onOpenRules: () => void; onOpenSettings: () => void }

export default function Toolbar({ onOpenRules, onOpenSettings }: Props) {
  const { undo, redo, duplicate, canUndo, canRedo, regionMode, toggleRegionMode } = useStore()

  return (
    <div data-testid="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
      <button onClick={undo} disabled={!canUndo()} title="Undo"><Undo2 size={15} /></button>
      <button onClick={redo} disabled={!canRedo()} title="Redo"><Redo2 size={15} /></button>
      <button onClick={() => void duplicate()} title="Duplicate"><Copy size={15} /></button>
      <button className={regionMode ? 'active' : ''} onClick={toggleRegionMode} title="Region select">
        <ScanLine size={15} />
      </button>
      <div style={{ flex: 1 }} />
      <button onClick={onOpenRules} title="Rules"><ListChecks size={15} /></button>
      <button onClick={onOpenSettings} title="Settings"><Settings size={15} /></button>
    </div>
  )
}
