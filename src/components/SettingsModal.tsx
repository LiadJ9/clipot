import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ProviderId } from '../../electron/shared/ipc'

const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'ollama']
const LABELS: Record<ProviderId, string> = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini', ollama: 'Ollama' }

type Props = { open: boolean; onClose: () => void }

export default function SettingsModal({ open, onClose }: Props) {
  const [status, setStatus] = useState<Record<ProviderId, boolean> | null>(null)
  const [values, setValues] = useState<Partial<Record<ProviderId, string>>>({})
  const [saved, setSaved] = useState<ProviderId | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.clipot.keyStatus()
      .then((s) => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setStatus(null) })
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const save = async (provider: ProviderId) => {
    const value = values[provider] ?? ''
    try {
      await window.clipot.setKey(provider, value)
      setValues((v) => ({ ...v, [provider]: '' }))
      setStatus((s) => (s ? { ...s, [provider]: value.length > 0 } : s))
      setSaved(provider)
      setTimeout(() => setSaved(null), 1500)
    } catch {
      // leave the field populated so the user can retry
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <span>Settings</span>
          <X size={16} style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div className="modal-body">
          {PROVIDERS.map((p) => (
            <div key={p} className="settings-row">
              <div className="settings-row-label">
                <span className={`dot ${status?.[p] ? 'ok' : 'off'}`} />
                {LABELS[p]}
              </div>
              <input
                type="password"
                placeholder={status?.[p] ? 'Key set — enter to replace' : 'Enter API key'}
                value={values[p] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
              />
              <button onClick={() => void save(p)}>{saved === p ? 'Saved' : 'Save'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
