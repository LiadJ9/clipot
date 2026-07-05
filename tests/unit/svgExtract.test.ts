import { describe, it, expect } from 'vitest'
import { extractSvg } from '@/lib/svgExtract'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="a" x="1"/></svg>'

describe('extractSvg', () => {
  it('pulls an svg out of a ```svg fenced block', () => {
    expect(extractSvg('Here is a dog:\n```svg\n' + SVG + '\n```')).toBe(SVG)
  })
  it('pulls an svg out of a ```xml fenced block', () => {
    expect(extractSvg('```xml\n' + SVG + '\n```')).toBe(SVG)
  })
  it('pulls an svg out of a plain ``` fence', () => {
    expect(extractSvg('```\n' + SVG + '\n```')).toBe(SVG)
  })
  it('pulls a bare <svg>…</svg> from prose', () => {
    expect(extractSvg('Sure! ' + SVG + ' Hope that helps.')).toBe(SVG)
  })
  it('returns null when there is no svg', () => {
    expect(extractSvg('I cannot help with that.')).toBeNull()
  })
  it('returns null for an unterminated svg', () => {
    expect(extractSvg('```svg\n<svg><rect/>\n```')).toBeNull()
  })
})
