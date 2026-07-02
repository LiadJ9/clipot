import { describe, it, expect } from 'vitest'
import { parseSvg, serializeSvg, ensureId, nextClipotId, SvgParseError, applyEdit } from '@/lib/svgDoc'

const SRC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="3"/><circle id="clipot-2" cx="5" cy="5" r="2"/></svg>`

describe('svgDoc', () => {
  it('parses valid svg to an <svg> root', () => {
    expect(parseSvg(SRC).tagName.toLowerCase()).toBe('svg')
  })
  it('throws SvgParseError on malformed input', () => {
    expect(() => parseSvg('<svg><rect></svg')).toThrow(SvgParseError)
  })
  it('round-trips through serialize', () => {
    expect(serializeSvg(parseSvg(SRC))).toContain('<circle')
  })
  it('nextClipotId is one past the highest existing clipot-N', () => {
    expect(nextClipotId(parseSvg(SRC))).toBe('clipot-3')
  })
  it('ensureId assigns a new id to an element lacking one', () => {
    const { source, id } = ensureId(SRC, [0]) // the <rect>
    expect(id).toBe('clipot-3')
    expect(source).toContain('id="clipot-3"')
  })
  it('ensureId returns the existing id without changing source', () => {
    const { source, id } = ensureId(SRC, [1]) // the <circle> already clipot-2
    expect(id).toBe('clipot-2')
    expect(source).toBe(SRC)
  })
})

describe('svgDoc.applyEdit', () => {
  const S = `<svg xmlns="http://www.w3.org/2000/svg"><rect x="1"/></svg>`
  it('applies a matching edit', () => {
    const r = applyEdit(S, { kind: 'edit', search: '<rect x="1"/>', replace: '<rect x="2"/>' })
    expect(r).toEqual({ ok: true, source: `<svg xmlns="http://www.w3.org/2000/svg"><rect x="2"/></svg>` })
  })
  it('reports no-match when search text is absent', () => {
    const r = applyEdit(S, { kind: 'edit', search: '<circle/>', replace: '<x/>' })
    expect(r).toEqual({ ok: false, reason: 'no-match', detail: expect.any(String) })
  })
  it('reports invalid-result when the edit breaks the SVG', () => {
    const r = applyEdit(S, { kind: 'edit', search: '<rect x="1"/>', replace: '<rect x="1"' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid-result')
  })
  it('applies a FILE block wholesale', () => {
    const r = applyEdit(S, { kind: 'file', content: `<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>` })
    expect(r).toEqual({ ok: true, source: `<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>` })
  })
})
