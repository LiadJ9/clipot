import { useState } from 'react'
import { Send } from 'lucide-react'
import { useStore } from '@/store/store'
import { joinPath } from '@/lib/path'
import { promptText } from '@/lib/promptDialog'
import { sanitizeFilename } from '@/lib/filename'
import logoUrl from '../../assets/logo.svg'

export default function NewFileView() {
  const { folder, streaming, sendPrompt, openFile } = useStore()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const prompt = text.trim()
    if (!prompt || streaming || !folder) return
    setText('')
    setError(null)
    await sendPrompt(prompt)
    const source = useStore.getState().source
    if (!source) return
    const suggested = sanitizeFilename(useStore.getState().suggestedName ?? '')
    const name = await promptText('Filename for the new SVG', suggested)
    if (!name) return
    const fileName = name.toLowerCase().endsWith('.svg') ? name : `${name}.svg`
    try {
      const path = joinPath(folder, fileName)
      await window.clipot.createFile(path, source)
      // Carry the generating conversation into the new file, then open it.
      await window.clipot.saveThread(folder, path, useStore.getState().thread)
      await openFile(path)
    } catch {
      setError('Failed to create the new file.')
    }
  }

  return (
    <div className="canvas-wrap new-file" data-testid="canvas">
      <img src={logoUrl} alt="" className="new-file-art" />
      <div className="new-file-prompt">
        {!folder && <div className="notice">Open a folder before creating a new SVG.</div>}
        <input
          value={text}
          disabled={!folder}
          data-testid="new-file-input"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
          placeholder="Describe the SVG you want to create…"
        />
        <button disabled={!folder} title="Send" data-testid="new-file-send" onClick={() => void send()}><Send size={14} /></button>
      </div>
      {error && <div className="notice">{error}</div>}
    </div>
  )
}
