import { useEffect, useState } from 'react'
import { Plus, Minus, Square, Copy, X } from 'lucide-react'
import logoUrl from '../../assets/logo.svg'

type Props = { onNewFile: () => void }

// Guarded accessor: window controls are absent under jsdom/unit tests.
const winApi = () => window.clipot?.window

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function TitleBar({ onNewFile }: Props) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const api = winApi()
    if (!api) return
    void api.isMaximized().then(setMaximized)
    return api.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div
      className="titlebar"
      style={drag}
      onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) winApi()?.toggleMaximize() }}
    >
      <img src={logoUrl} width={18} height={18} alt="" />
      <span className="name">clipot</span>
      <div style={{ flex: 1 }} />
      <button onClick={onNewFile} title="New SVG" style={{ ...noDrag, background: 'var(--accent)', color: 'var(--bg)' }}>
        <Plus size={16} />
      </button>
      <div className="win-controls" style={noDrag}>
        <button className="win-btn" onClick={() => winApi()?.minimize()} title="Minimize"><Minus size={15} /></button>
        <button className="win-btn" onClick={() => winApi()?.toggleMaximize()} title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button className="win-btn close" onClick={() => winApi()?.close()} title="Close"><X size={16} /></button>
      </div>
    </div>
  )
}
