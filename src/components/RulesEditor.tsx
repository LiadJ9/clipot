import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/store/store'

type Props = { open: boolean; onClose: () => void }

export default function RulesEditor({ open, onClose }: Props) {
  const { rules, setRules, folder } = useStore()
  const [text, setText] = useState(rules)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setText(rules); setError(null) }
  }, [open, rules])

  if (!open) return null

  const save = async () => {
    setRules(text)
    if (folder) {
      try {
        await window.clipot.saveRules(folder, text)
      } catch {
        setError('Failed to save rules to disk.')
        return
      }
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <span>Rules</span>
          <X size={16} style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div className="modal-body">
          <textarea
            className="rules-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Project rules for the assistant to follow…"
          />
          {error && <div className="notice">{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={{ background: 'var(--accent)', color: 'var(--bg)' }} onClick={() => void save()}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
