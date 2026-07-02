// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkpoint, listCheckpoints, saveThread, loadThread, saveRules, loadRules } from '../../electron/services/history'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'clipot-h-')) })
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('history', () => {
  it('writes numbered checkpoints and lists them', async () => {
    const f = join(dir, 'logo.svg')
    await checkpoint(dir, f, '<svg/>', 'make-roof-orange')
    await checkpoint(dir, f, '<svg/>', 'darker')
    const list = await listCheckpoints(dir, f)
    expect(list.map((c) => c.label)).toEqual(['001-make-roof-orange', '002-darker'])
  })
  it('round-trips a thread', async () => {
    const f = join(dir, 'logo.svg')
    await saveThread(dir, f, [{ role: 'user', content: 'hi' }])
    expect(await loadThread(dir, f)).toEqual([{ role: 'user', content: 'hi' }])
  })
  it('round-trips rules to .clipot/rules.md', async () => {
    expect(await loadRules(dir)).toBeNull()
    await saveRules(dir, 'Keep it minimal.')
    expect(await loadRules(dir)).toBe('Keep it minimal.')
  })
  it('keys history on folder-relative path so same-named files in subfolders stay distinct', async () => {
    const a = join(dir, 'a', 'logo.svg')
    const b = join(dir, 'b', 'logo.svg')
    await checkpoint(dir, a, '<svg id="a"/>', 'edit-a')
    await checkpoint(dir, b, '<svg id="b"/>', 'edit-b')
    // Distinct checkpoint dirs: each subfolder file has exactly its own checkpoint.
    expect((await listCheckpoints(dir, a)).map((c) => c.label)).toEqual(['001-edit-a'])
    expect((await listCheckpoints(dir, b)).map((c) => c.label)).toEqual(['001-edit-b'])

    // Distinct thread files: no cross-contamination between a/logo and b/logo.
    await saveThread(dir, a, [{ role: 'user', content: 'from a' }])
    await saveThread(dir, b, [{ role: 'user', content: 'from b' }])
    expect(await loadThread(dir, a)).toEqual([{ role: 'user', content: 'from a' }])
    expect(await loadThread(dir, b)).toEqual([{ role: 'user', content: 'from b' }])
  })
})
