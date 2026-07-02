// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnthropicEvents } from '../../electron/services/llm/anthropic'

describe('anthropic stream parsing', () => {
  it('extracts text deltas from recorded SSE', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/anthropic-stream.txt'), 'utf8')
    const dataLines = raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim())
    expect(parseAnthropicEvents(dataLines).join('')).toBe('Hello world')
  })
})
