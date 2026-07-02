import { useEffect, useState } from 'react'
import { X, Check, RotateCcw } from 'lucide-react'
import { useStore } from '@/store/store'

type Checkpoint = { path: string; label: string }

function countEdits(content: string): number {
  const m = content.match(/<<<(EDIT|FILE)/g)
  return m ? m.length : 0
}

// Strip raw edit-block markup for display, keeping any surrounding explanation text.
function displayText(content: string): string {
  const stripped = content.replace(/<<<EDIT[\s\S]*?>>>/g, '').replace(/<<<FILE[\s\S]*?>>>/g, '').trim()
  return stripped || '(edit applied)'
}

export default function ThreadDrawer() {
  const { threadOpen, toggleThread, thread, folder, activePath } = useStore()
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!threadOpen || !folder || !activePath) { setCheckpoints([]); return }
    let cancelled = false
    window.clipot.listCheckpoints(folder, activePath)
      .then((list) => { if (!cancelled) setCheckpoints(list) })
      .catch(() => { if (!cancelled) setCheckpoints([]) })
    return () => { cancelled = true }
  }, [threadOpen, folder, activePath])

  if (!threadOpen) return null

  const rollback = async (cp: Checkpoint) => {
    if (!activePath) return
    try {
      const content = await window.clipot.readFile(cp.path)
      useStore.getState().rollbackTo(content)
      setError(null)
    } catch {
      setError('Failed to roll back to that checkpoint.')
    }
  }

  return (
    <div className="drawer" data-testid="thread-drawer">
      <div className="drawer-hd">
        <span>Thread</span>
        <X size={14} style={{ cursor: 'pointer' }} onClick={toggleThread} />
      </div>
      <div className="drawer-body">
        {thread.length === 0 && <div style={{ color: 'var(--text-ghost)', padding: 8 }}>No messages yet.</div>}
        {thread.map((m, i) => {
          const edits = m.role === 'assistant' ? countEdits(m.content) : 0
          return (
            <div key={i} className={`thread-msg ${m.role}`}>
              <div className="thread-role">{m.role}</div>
              <div className="thread-text">{m.role === 'assistant' ? displayText(m.content) : m.content}</div>
              {edits > 0 && <span className="edit-tag"><Check size={10} /> {edits} edit{edits === 1 ? '' : 's'}</span>}
            </div>
          )
        })}
      </div>
      {checkpoints.length > 0 && (
        <div className="drawer-checkpoints">
          <div className="hd">Checkpoints</div>
          {checkpoints.map((cp) => (
            <div key={cp.path} className="menu-item checkpoint-row" onClick={() => void rollback(cp)}>
              <span>{cp.label}</span>
              <RotateCcw size={12} />
            </div>
          ))}
        </div>
      )}
      {error && <div className="notice">{error}</div>}
    </div>
  )
}
