import { describe, it, expect } from 'vitest'
import { createEditParser, IncompleteBlockError } from '@/lib/editStream'

function parseAll(chunks: string[]) {
  const p = createEditParser()
  const out = chunks.flatMap((c) => p.push(c))
  return out.concat(p.flush())
}

const EDIT = `intro\n<<<EDIT\nSEARCH:\n<rect x="1"/>\nREPLACE:\n<rect x="2"/>\n>>>\ntrailing`
const FILE = `<<<FILE\n<svg><rect/></svg>\n>>>`

describe('editStream', () => {
  it('parses a whole EDIT block from one chunk', () => {
    const blocks = parseAll([EDIT])
    expect(blocks).toEqual([{ kind: 'edit', search: '<rect x="1"/>', replace: '<rect x="2"/>' }])
  })
  it('parses a FILE block', () => {
    expect(parseAll([FILE])).toEqual([{ kind: 'file', content: '<svg><rect/></svg>' }])
  })
  it('parses across arbitrary chunk boundaries', () => {
    const chunks = EDIT.match(/.{1,3}/gs)!  // split into 3-char pieces
    expect(parseAll(chunks)).toEqual([{ kind: 'edit', search: '<rect x="1"/>', replace: '<rect x="2"/>' }])
  })
  it('parses multiple EDIT blocks in sequence', () => {
    const two = EDIT + '\n' + EDIT
    expect(parseAll([two]).length).toBe(2)
  })
  it('flush throws on an unterminated block', () => {
    const p = createEditParser()
    p.push('<<<EDIT\nSEARCH:\nx\nREPLACE:\ny\n')
    expect(() => p.flush()).toThrow(IncompleteBlockError)
  })
  it('captures a filename on the FILE open line', () => {
    const blocks = parseAll(['<<<FILE dog.svg\n<svg/>\n>>>'])
    expect(blocks).toEqual([{ kind: 'file', content: '<svg/>', name: 'dog.svg' }])
  })
  it('omits name when the FILE block has none', () => {
    const blocks = parseAll(['<<<FILE\n<svg/>\n>>>'])
    expect(blocks).toEqual([{ kind: 'file', content: '<svg/>' }])
  })
})
