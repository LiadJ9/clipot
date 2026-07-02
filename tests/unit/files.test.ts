// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readTree, writeFileAtomic, readFile, duplicateFile } from '../../electron/services/files'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clipot-'))
  await mkdir(join(dir, 'icons'))
  await writeFile(join(dir, 'icons', 'a.svg'), '<svg/>')
  await writeFile(join(dir, 'notes.txt'), 'ignore me')
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('files', () => {
  it('reads a tree of only svg files plus dirs', async () => {
    const tree = await readTree(dir)
    const names = tree.children!.map((c) => c.name).sort()
    expect(names).toEqual(['icons'])
    expect(tree.children!.find((c) => c.name === 'icons')!.children!.map((c) => c.name)).toEqual(['a.svg'])
  })
  it('writes atomically and reads back', async () => {
    const p = join(dir, 'icons', 'a.svg')
    await writeFileAtomic(p, '<svg id="x"/>')
    expect(await readFile(p)).toBe('<svg id="x"/>')
  })
  it('duplicate creates a " copy" sibling', async () => {
    const p = await duplicateFile(join(dir, 'icons', 'a.svg'))
    expect(p.endsWith('a copy.svg')).toBe(true)
    expect(await readFile(p)).toBe('<svg/>')
  })
})
