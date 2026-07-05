// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveKey } from '../../electron/services/vault'

describe('vault.resolveKey', () => {
  it('prefers the env var over the stored value', () => {
    expect(resolveKey('anthropic', { anthropic: 'stored' }, { ANTHROPIC_API_KEY: 'env' } as any)).toBe('env')
  })
  it('falls back to the stored value', () => {
    expect(resolveKey('openai', { openai: 'stored' }, {} as any)).toBe('stored')
  })
  it('returns null when neither is set', () => {
    expect(resolveKey('gemini', {}, {} as any)).toBeNull()
  })
  it('maps ollama to OLLAMA_HOST', () => {
    expect(resolveKey('ollama', {}, { OLLAMA_HOST: 'http://localhost:11434' } as any)).toBe('http://localhost:11434')
  })
  it('trims surrounding whitespace/newlines from a pasted key', () => {
    expect(resolveKey('gemini', { gemini: '  AIzaKEY\n' }, {} as any)).toBe('AIzaKEY')
  })
  it('treats a whitespace-only key as no key', () => {
    expect(resolveKey('gemini', { gemini: '   ' }, {} as any)).toBeNull()
  })
})
