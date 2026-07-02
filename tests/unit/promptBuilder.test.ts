import { describe, it, expect } from 'vitest'
import { buildMessages, EDIT_PROTOCOL, DEFAULT_RULES } from '@/lib/promptBuilder'
import type { Selection } from '@/lib/selection'

const S = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1" x="1"/></svg>`
const sel: Selection[] = [{ n: 1, id: 'clipot-1', label: 'rect', stale: false }]

describe('promptBuilder', () => {
  it('system message contains the protocol and rules', () => {
    const [sys] = buildMessages({ source: S, prompt: 'hi', selections: [], rules: DEFAULT_RULES, history: [] })
    expect(sys.role).toBe('system')
    expect(sys.content).toContain(EDIT_PROTOCOL)
    expect(sys.content).toContain(DEFAULT_RULES)
  })
  it('expands @n mentions to the element source in the user message', () => {
    const msgs = buildMessages({ source: S, prompt: 'make @1 wider', selections: sel, rules: '', history: [] })
    const user = msgs[msgs.length - 1]
    expect(user.role).toBe('user')
    expect(user.content).toContain('clipot-1')
    expect(user.content).toContain('rect')
  })
  it('includes full source when small', () => {
    const user = buildMessages({ source: S, prompt: 'x', selections: [], rules: '', history: [] }).at(-1)!
    expect(user.content).toContain(S)
  })
  it('places history between system and user', () => {
    const history = [{ role: 'user' as const, content: 'earlier' }, { role: 'assistant' as const, content: 'ok' }]
    const msgs = buildMessages({ source: S, prompt: 'now', selections: [], rules: '', history })
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
  })
})
