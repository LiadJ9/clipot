// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOpenAiEvents } from '../../electron/services/llm/openai'
import { parseGeminiEvents } from '../../electron/services/llm/gemini'
import { parseOllamaLines, ollama } from '../../electron/services/llm/ollama'

const load = (n: string) => readFileSync(join(__dirname, `../fixtures/${n}`), 'utf8')
const dataLines = (raw: string) => raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim())

describe('other provider parsers', () => {
  it('openai', () => expect(parseOpenAiEvents(dataLines(load('openai-stream.txt'))).join('')).toBe('Hello world'))
  it('gemini', () => expect(parseGeminiEvents(dataLines(load('gemini-stream.txt'))).join('')).toBe('Hello world'))
  it('ollama', () => expect(parseOllamaLines(load('ollama-stream.txt').split('\n').filter(Boolean)).join('')).toBe('Hello world'))
  it('ollama vision detection', () => {
    expect(ollama.supportsVision('llava:13b')).toBe(true)
    expect(ollama.supportsVision('qwen2.5:7b')).toBe(false)
  })
})
