import { describe, it, expect } from 'vitest'
import { revalidate, labelFor, type Selection } from '@/lib/selection'

const S = `<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/><circle id="roof"/></svg>`

describe('selection', () => {
  it('keeps selections whose id still exists', () => {
    const sel: Selection[] = [{ n: 1, id: 'clipot-1', label: 'clipot-1', stale: false }]
    expect(revalidate(S, sel)[0].stale).toBe(false)
  })
  it('marks a selection stale when its id vanished', () => {
    const sel: Selection[] = [{ n: 1, id: 'gone', label: 'gone', stale: false }]
    expect(revalidate(S, sel)[0].stale).toBe(true)
  })
  it('labelFor prefers id, falls back to tag name', () => {
    expect(labelFor(S, 'roof')).toBe('roof')
  })
})
