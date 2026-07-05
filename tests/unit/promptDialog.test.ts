import { describe, it, expect, beforeEach } from 'vitest'
import { promptText, settlePrompt, getPromptState, subscribePrompt } from '@/lib/promptDialog'

beforeEach(() => settlePrompt(null)) // clear any pending prompt between tests

describe('promptDialog', () => {
  it('resolves with the value when settled with a string', async () => {
    const p = promptText('Filename', 'untitled.svg')
    expect(getPromptState()).toEqual({ message: 'Filename', defaultValue: 'untitled.svg' })
    settlePrompt('dog.svg')
    expect(await p).toBe('dog.svg')
    expect(getPromptState()).toBeNull()
  })

  it('resolves with null when cancelled', async () => {
    const p = promptText('Rename to', 'a.svg')
    settlePrompt(null)
    expect(await p).toBeNull()
  })

  it('opening a second prompt cancels the first (resolves it null)', async () => {
    const first = promptText('First', '')
    const second = promptText('Second', '')
    expect(await first).toBeNull()
    expect(getPromptState()).toEqual({ message: 'Second', defaultValue: '' })
    settlePrompt('x')
    expect(await second).toBe('x')
  })

  it('notifies subscribers on open and settle', () => {
    let n = 0
    const unsub = subscribePrompt(() => { n++ })
    void promptText('m', '')
    settlePrompt('v')
    unsub()
    expect(n).toBe(2)
  })
})
