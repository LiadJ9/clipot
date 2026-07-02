import { useEffect, useRef, useState } from 'react'
import { X, Send, Square, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/store'
import type { ProviderId } from '../../electron/shared/ipc'

const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'ollama']

function ModelPicker() {
  const { provider, model, setModel } = useStore()
  const [open, setOpen] = useState(false)
  const [pickerProvider, setPickerProvider] = useState<ProviderId>(provider)
  const [models, setModels] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.clipot
      .listModels(pickerProvider)
      .then((list) => { if (!cancelled) setModels(list) })
      .catch(() => { if (!cancelled) setModels([]) })
    return () => { cancelled = true }
  }, [open, pickerProvider])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        className="chip"
        style={{ cursor: 'pointer' }}
        onClick={() => { setPickerProvider(provider); setOpen((o) => !o) }}
      >
        {provider}/{model} <ChevronDown size={12} />
      </button>
      {open && (
        <div className="menu" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 2, padding: '2px 2px 6px' }}>
            {PROVIDERS.map((p) => (
              <div
                key={p}
                className="menu-item"
                style={p === pickerProvider ? { background: 'var(--panel)', color: 'var(--text)' } : undefined}
                onClick={() => setPickerProvider(p)}
              >
                {p}
              </div>
            ))}
          </div>
          {models.length === 0 && <div className="menu-item" style={{ color: 'var(--text-ghost)' }}>No models</div>}
          {models.map((m) => (
            <div key={m} className="menu-item" onClick={() => { setModel(pickerProvider, m); setOpen(false) }}>
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PromptBar() {
  const { selections, removeSelection, streaming, sendPrompt, stopStream } = useStore()
  const [text, setText] = useState('')

  const send = () => {
    const prompt = text.trim()
    if (!prompt || streaming) return
    setText('')
    void sendPrompt(prompt)
  }

  return (
    <div data-testid="prompt-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--panel)', borderTop: '1px solid var(--border)' }}>
      {selections.map((s) => (
        <span key={s.n} className={`chip${s.stale ? ' stale' : ''}`}>
          @{s.n} {s.label}
          <X size={11} style={{ marginLeft: 4, cursor: 'pointer', verticalAlign: 'middle' }} onClick={() => removeSelection(s.n)} />
        </span>
      ))}
      <input
        data-testid="prompt-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        placeholder="Describe the change…"
        style={{
          flex: 1, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text)', padding: '7px 10px', font: 'inherit',
        }}
      />
      <ModelPicker />
      {streaming ? (
        <button onClick={stopStream} title="Stop"><Square size={14} /></button>
      ) : (
        <button data-testid="prompt-send" onClick={send} title="Send"><Send size={14} /></button>
      )}
    </div>
  )
}
