import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store/store'

beforeEach(() => useStore.setState({ selections: [], source: '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>' }))

describe('store selections', () => {
  it('adds a selection with the next number', () => {
    useStore.getState().addSelection('clipot-1', 'rect')
    expect(useStore.getState().selections).toEqual([{ n: 1, id: 'clipot-1', label: 'rect', stale: false }])
  })
  it('does not add the same id twice', () => {
    useStore.getState().addSelection('clipot-1', 'rect')
    useStore.getState().addSelection('clipot-1', 'rect')
    expect(useStore.getState().selections.length).toBe(1)
  })
  it('removes and renumbers', () => {
    const s = useStore.getState()
    s.addSelection('a', 'a'); s.addSelection('b', 'b'); s.removeSelection(1)
    expect(useStore.getState().selections.map((x) => [x.n, x.id])).toEqual([[1, 'b']])
  })
})
