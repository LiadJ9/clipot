import { useState, useEffect, useSyncExternalStore } from 'react'
import { getPromptState, subscribePrompt, settlePrompt } from '@/lib/promptDialog'

export default function PromptHost() {
  const req = useSyncExternalStore(subscribePrompt, getPromptState, () => null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (req) setValue(req.defaultValue)
  }, [req])

  if (!req) return null

  return (
    <div className="modal-overlay" onClick={() => settlePrompt(null)}>
      <div className="modal prompt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd"><span>{req.message}</span></div>
        <div className="modal-body">
          <input
            autoFocus
            data-testid="prompt-modal-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') settlePrompt(value)
              else if (e.key === 'Escape') settlePrompt(null)
            }}
          />
          <div className="prompt-modal-actions">
            <button onClick={() => settlePrompt(null)}>Cancel</button>
            <button data-testid="prompt-modal-ok" onClick={() => settlePrompt(value)}>OK</button>
          </div>
        </div>
      </div>
    </div>
  )
}
