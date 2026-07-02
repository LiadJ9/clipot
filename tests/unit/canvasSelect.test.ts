import { describe, it, expect } from 'vitest'
import { resolveClick, stampPaths } from '@/lib/canvasSelect'
import type { Selection } from '@/lib/selection'

function parse(source: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  return doc.documentElement as unknown as SVGSVGElement
}

describe('resolveClick', () => {
  it('maps a click to its original stamped path even after live-DOM reordering', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg"><g><path/><path/><path/></g></svg>`)
    stampPaths(root)
    const g = root.firstElementChild as Element
    const third = g.children[2]
    // simulate the highlight loop moving the 2nd child to the end (topmost)
    g.appendChild(g.children[1])
    expect(resolveClick(root, third, [])).toEqual({ kind: 'select', path: [0, 2] })
  })

  it('deselects when clicking an element whose id matches a selection', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg"><g><rect id="clipot-1"/></g></svg>`)
    stampPaths(root)
    const rect = root.querySelector('#clipot-1')!
    const selections: Selection[] = [{ n: 1, id: 'clipot-1', label: 'clipot-1', stale: false }]
    expect(resolveClick(root, rect, selections)).toEqual({ kind: 'deselect', n: 1 })
  })

  it('deselects when clicking a child of a selected element', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg"><g id="clipot-1"><rect/></g></svg>`)
    stampPaths(root)
    const rect = root.querySelector('rect')!
    const selections: Selection[] = [{ n: 1, id: 'clipot-1', label: 'clipot-1', stale: false }]
    expect(resolveClick(root, rect, selections)).toEqual({ kind: 'deselect', n: 1 })
  })

  it('ignores clicks on the root', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`)
    stampPaths(root)
    expect(resolveClick(root, root, [])).toEqual({ kind: 'none' })
  })
})
