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
})
