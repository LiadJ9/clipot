import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { useStore } from '@/store/store'

export default function ActivityStrip() {
  const { streaming, activity, editCount, threadOpen, toggleThread, error, clearError } = useStore()

  return (
    <div data-testid="activity-strip" style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
      {error && (
        <div className="notice">
          <span>{error}</span>
          <X size={12} style={{ cursor: 'pointer' }} onClick={clearError} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', minHeight: 24, background: '#140f09' }}>
        {streaming && <span className="pulse-dot" />}
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11,
        }}>
          {streaming ? activity : ''}
        </span>
        {streaming && editCount && (
          <span className="edit-tag">edit {editCount.done}/{editCount.total}</span>
        )}
        <button onClick={toggleThread} title="Thread history">
          {threadOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
    </div>
  )
}
