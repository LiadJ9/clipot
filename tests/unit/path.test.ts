import { describe, it, expect } from 'vitest'
import { joinPath } from '@/lib/path'

describe('joinPath', () => {
  it('joins with a forward slash for posix-style dirs', () => {
    expect(joinPath('/a/b', 'c.svg')).toBe('/a/b/c.svg')
  })
  it('joins with a backslash for windows-style dirs', () => {
    expect(joinPath('C:\\a\\b', 'c.svg')).toBe('C:\\a\\b\\c.svg')
  })
  it('returns the name unchanged when dir is empty', () => {
    expect(joinPath('', 'c.svg')).toBe('c.svg')
  })
})
