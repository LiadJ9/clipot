import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from './vault'

// Non-secret session preferences (API keys live in the encrypted vault, not here).
export type Prefs = {
  provider?: ProviderId
  model?: string
  folder?: string
  activePath?: string | null
}

const file = (dir: string) => join(dir, 'prefs.json')

export function loadPrefs(dir: string): Prefs {
  try {
    return JSON.parse(readFileSync(file(dir), 'utf8')) as Prefs
  } catch {
    return {}
  }
}

export function savePrefs(dir: string, prefs: Prefs): void {
  writeFileSync(file(dir), JSON.stringify(prefs, null, 2), 'utf8')
}
