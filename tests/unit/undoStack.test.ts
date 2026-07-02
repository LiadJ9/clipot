import { describe, it, expect } from 'vitest'
import { createUndoStack } from '@/lib/undoStack'

describe('undoStack', () => {
  it('undo/redo walks the history', () => {
    const s = createUndoStack('a')
    s.push('b'); s.push('c')
    expect(s.current()).toBe('c')
    expect(s.undo()).toBe('b')
    expect(s.undo()).toBe('a')
    expect(s.undo()).toBeNull()
    expect(s.redo()).toBe('b')
  })
  it('push after undo truncates the redo branch', () => {
    const s = createUndoStack('a')
    s.push('b'); s.undo(); s.push('x')
    expect(s.current()).toBe('x')
    expect(s.canRedo()).toBe(false)
  })
})
