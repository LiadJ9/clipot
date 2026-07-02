import { describe, it, expect } from 'vitest'
import { sanitize } from '@/components/CanvasView'

function parse(source: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  return doc.documentElement as unknown as SVGSVGElement
}

describe('sanitize', () => {
  it('strips on* attributes from the root <svg> element itself', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>`)
    sanitize(root)
    expect(root.hasAttribute('onload')).toBe(false)
  })
  it('removes <script> elements', () => {
    const root = parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect onclick="alert(2)"/></svg>`
    )
    sanitize(root)
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('rect')?.hasAttribute('onclick')).toBe(false)
  })
  it('strips javascript: link targets from href and xlink:href', () => {
    const root = parse(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<a xlink:href="javascript:alert(1)"><rect/></a>` +
        `<a href="javascript:alert(2)"><circle/></a></svg>`
    )
    sanitize(root)
    const anchors = root.querySelectorAll('a')
    expect(anchors[0].hasAttribute('xlink:href')).toBe(false)
    expect(anchors[1].hasAttribute('href')).toBe(false)
  })
  it('preserves allowed link targets (#fragment and https)', () => {
    const root = parse(
      `<svg xmlns="http://www.w3.org/2000/svg">` +
        `<a href="#foo"><rect/></a><a href="https://example.com"><circle/></a></svg>`
    )
    sanitize(root)
    const anchors = root.querySelectorAll('a')
    expect(anchors[0].getAttribute('href')).toBe('#foo')
    expect(anchors[1].getAttribute('href')).toBe('https://example.com')
  })
  it('removes SMIL animation elements (<set>, <animate>)', () => {
    const root = parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><rect>` +
        `<set attributeName="href" to="javascript:alert(1)"/>` +
        `<animate attributeName="fill" to="red"/></rect></svg>`
    )
    sanitize(root)
    expect(root.querySelector('set')).toBeNull()
    expect(root.querySelector('animate')).toBeNull()
  })
})
