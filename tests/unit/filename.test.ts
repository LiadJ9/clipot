import { describe, it, expect } from 'vitest'
import { sanitizeFilename } from '@/lib/filename'

describe('sanitizeFilename', () => {
  it('adds a .svg extension when missing', () => { expect(sanitizeFilename('dog')).toBe('dog.svg') })
  it('keeps an existing .svg extension', () => { expect(sanitizeFilename('dog.svg')).toBe('dog.svg') })
  it('keeps digits and hyphens', () => { expect(sanitizeFilename('icon-2')).toBe('icon-2.svg') })
  it('strips directory components (posix and windows)', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd.svg')
    expect(sanitizeFilename('a\\b\\c.svg')).toBe('c.svg')
  })
  it('drops reserved characters', () => { expect(sanitizeFilename('a<b>:"c')).toBe('abc.svg') })
  it('falls back to untitled.svg for empty/whitespace', () => {
    expect(sanitizeFilename('')).toBe('untitled.svg')
    expect(sanitizeFilename('   ')).toBe('untitled.svg')
  })
})
