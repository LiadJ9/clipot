// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPrefs, savePrefs } from '../../electron/services/prefs'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'clipot-prefs-')) })
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('prefs', () => {
  it('returns {} when no prefs file exists', () => {
    expect(loadPrefs(dir)).toEqual({})
  })
  it('round-trips provider/model/folder/activePath', () => {
    const p = { provider: 'gemini' as const, model: 'gemini-2.5-flash', folder: '/f', activePath: '/f/a.svg' }
    savePrefs(dir, p)
    expect(loadPrefs(dir)).toEqual(p)
  })
  it('returns {} on corrupt prefs file', () => {
    savePrefs(dir, { model: 'x' })
    writeFileSync(join(dir, 'prefs.json'), '{ not json') // overwrite with junk
    expect(loadPrefs(dir)).toEqual({})
  })
})
