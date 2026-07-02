import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, pathExists } from '@/store/store'
import type { TreeNode } from '../../electron/shared/ipc'

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

describe('pathExists', () => {
  const tree: TreeNode = {
    name: 'root', path: '/root', kind: 'dir',
    children: [
      { name: 'a.svg', path: '/root/a.svg', kind: 'file' },
      { name: 'sub', path: '/root/sub', kind: 'dir', children: [{ name: 'b.svg', path: '/root/sub/b.svg', kind: 'file' }] },
    ],
  }
  it('finds the root itself', () => {
    expect(pathExists(tree, '/root')).toBe(true)
  })
  it('finds a nested file at any depth', () => {
    expect(pathExists(tree, '/root/sub/b.svg')).toBe(true)
  })
  it('returns false for a path no longer in the tree', () => {
    expect(pathExists(tree, '/root/gone.svg')).toBe(false)
  })
  it('returns false for a null tree', () => {
    expect(pathExists(null, '/root/a.svg')).toBe(false)
  })
})
