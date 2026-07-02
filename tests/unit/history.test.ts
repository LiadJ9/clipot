// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkpoint, listCheckpoints, saveThread, loadThread } from '../../electron/services/history'

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
})
