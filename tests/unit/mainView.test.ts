import { describe, it, expect } from 'vitest'
import { mainView, hasSvgs } from '@/lib/mainView'
import type { TreeNode } from '../../electron/shared/ipc'

const withSvg: TreeNode = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'a.svg', path: '/f/a.svg', kind: 'file' }] }
const empty: TreeNode = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'notes.txt', path: '/f/notes.txt', kind: 'file' }] }
const nested: TreeNode = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'sub', path: '/f/sub', kind: 'dir', children: [{ name: 'b.svg', path: '/f/sub/b.svg', kind: 'file' }] }] }

describe('hasSvgs', () => {
  it('is false for null / no svgs, true when an svg exists at any depth', () => {
    expect(hasSvgs(null)).toBe(false)
    expect(hasSvgs(empty)).toBe(false)
    expect(hasSvgs(withSvg)).toBe(true)
    expect(hasSvgs(nested)).toBe(true)
  })
})

describe('mainView', () => {
  it('no folder → no-folder (even in new mode)', () => {
    expect(mainView({ folder: null, mode: 'new', activePath: null, tree: null })).toBe('no-folder')
  })
  it('folder + new mode → new', () => {
    expect(mainView({ folder: '/f', mode: 'new', activePath: null, tree: withSvg })).toBe('new')
  })
  it('folder, no active file, no svgs → empty-folder', () => {
    expect(mainView({ folder: '/f', mode: 'edit', activePath: null, tree: empty })).toBe('empty-folder')
  })
  it('folder, no active file, has svgs → no-file', () => {
    expect(mainView({ folder: '/f', mode: 'edit', activePath: null, tree: withSvg })).toBe('no-file')
  })
  it('folder + active file → canvas', () => {
    expect(mainView({ folder: '/f', mode: 'edit', activePath: '/f/a.svg', tree: withSvg })).toBe('canvas')
  })
})
