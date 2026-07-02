import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama'
export type KeyStore = Partial<Record<ProviderId, string>>

const ENV_VAR: Record<ProviderId, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  ollama: 'OLLAMA_HOST',
}

export function resolveKey(provider: ProviderId, store: KeyStore, env: NodeJS.ProcessEnv): string | null {
  return env[ENV_VAR[provider]] ?? store[provider] ?? null
}

type SafeStorage = { encryptString(s: string): Buffer; decryptString(b: Buffer): string; isEncryptionAvailable(): boolean }
const file = (dir: string) => join(dir, 'keys.enc')

export function loadStore(userDataDir: string, safeStorage: SafeStorage): KeyStore {
  const f = file(userDataDir)
  if (!existsSync(f) || !safeStorage.isEncryptionAvailable()) return {}
  try { return JSON.parse(safeStorage.decryptString(readFileSync(f))) } catch { return {} }
}

export function saveStore(userDataDir: string, safeStorage: SafeStorage, store: KeyStore): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Encryption unavailable on this platform')
  writeFileSync(file(userDataDir), safeStorage.encryptString(JSON.stringify(store)))
}
