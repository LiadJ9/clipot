import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/store/store'
import type { ProviderId } from '../../electron/shared/ipc'

const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'ollama']
const LABELS: Record<ProviderId, string> = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini', ollama: 'Ollama' }

type Props = { open: boolean; onClose: () => void }

export default function SettingsModal({ open, onClose }: Props) {
  const { provider, model, setModel } = useStore()
  const [status, setStatus] = useState<Record<ProviderId, boolean> | null>(null)
  const [values, setValues] = useState<Partial<Record<ProviderId, string>>>({})
  const [saved, setSaved] = useState<ProviderId | null>(null)
  const [pickerProvider, setPickerProvider] = useState<ProviderId>(provider)
  const [models, setModels] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.clipot.keyStatus()
      .then((s) => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setStatus(null) })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (open) setPickerProvider(provider)
  }, [open, provider])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.clipot.listModels(pickerProvider)
      .then((list) => { if (!cancelled) setModels(list) })
      .catch(() => { if (!cancelled) setModels([]) })
    return () => { cancelled = true }
  }, [open, pickerProvider])

  if (!open) return null

  const save = async (p: ProviderId) => {
    const value = values[p] ?? ''
    try {
      await window.clipot.setKey(p, value)
      setValues((v) => ({ ...v, [p]: '' }))
      setStatus((s) => (s ? { ...s, [p]: value.length > 0 } : s))
      setSaved(p)
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
          <div className="settings-row">
            <div className="settings-row-label">Default model</div>
            <select
              value={pickerProvider}
              onChange={(e) => setPickerProvider(e.target.value as ProviderId)}
            >
              {PROVIDERS.map((p) => <option key={p} value={p}>{LABELS[p]}</option>)}
            </select>
            <select
              value={pickerProvider === provider ? model : ''}
              onChange={(e) => setModel(pickerProvider, e.target.value)}
            >
              <option value="" disabled>{models.length ? 'Select a model' : 'No models'}</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
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
