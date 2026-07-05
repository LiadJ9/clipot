import { describe, it, expect } from 'vitest'
import { promptHistory, navigateHistory } from '@/lib/promptHistory'
import type { ChatMessage } from '@/lib/promptBuilder'

describe('promptHistory', () => {
  it('returns user prompts in order', () => {
    const t: ChatMessage[] = [
      { role: 'user', content: 'a' }, { role: 'assistant', content: 'x' }, { role: 'user', content: 'b' },
    ]
    expect(promptHistory(t)).toEqual(['a', 'b'])
  })
  it('caps to the most recent 50', () => {
    const t: ChatMessage[] = Array.from({ length: 60 }, (_, i) => ({ role: 'user' as const, content: String(i) }))
    const h = promptHistory(t)
    expect(h.length).toBe(50)
    expect(h[0]).toBe('10')
    expect(h[49]).toBe('59')
  })
})

describe('navigateHistory', () => {
  const h = ['old', 'mid', 'new']
  it('up from draft selects the most recent', () => {
    expect(navigateHistory(h, null, 'draft', 'up')).toEqual({ index: 2, text: 'new' })
  })
  it('up goes older and clamps at the oldest', () => {
    expect(navigateHistory(h, 2, 'draft', 'up')).toEqual({ index: 1, text: 'mid' })
    expect(navigateHistory(h, 0, 'draft', 'up')).toEqual({ index: 0, text: 'old' })
  })
  it('down goes newer; past the newest restores the draft', () => {
    expect(navigateHistory(h, 0, 'draft', 'down')).toEqual({ index: 1, text: 'mid' })
    expect(navigateHistory(h, 2, 'draft', 'down')).toEqual({ index: null, text: 'draft' })
  })
  it('down from draft stays on the draft', () => {
    expect(navigateHistory(h, null, 'draft', 'down')).toEqual({ index: null, text: 'draft' })
  })
})
