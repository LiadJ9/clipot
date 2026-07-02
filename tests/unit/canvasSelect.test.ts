import { describe, it, expect } from 'vitest'
import { resolveClick, stampPaths, rectsIntersect, keepLeafMost } from '@/lib/canvasSelect'
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

describe('rectsIntersect', () => {
  it('detects overlapping rects', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    const b = { left: 5, top: 5, right: 15, bottom: 15 }
    expect(rectsIntersect(a, b)).toBe(true)
  })

  it('treats rects that only touch at an edge as non-intersecting', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    const b = { left: 10, top: 0, right: 20, bottom: 10 }
    expect(rectsIntersect(a, b)).toBe(false)
  })

  it('returns false for fully disjoint rects', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    const b = { left: 20, top: 20, right: 30, bottom: 30 }
    expect(rectsIntersect(a, b)).toBe(false)
  })

  it('detects a rect fully contained within another', () => {
    const a = { left: 0, top: 0, right: 100, bottom: 100 }
    const b = { left: 10, top: 10, right: 20, bottom: 20 }
    expect(rectsIntersect(a, b)).toBe(true)
    expect(rectsIntersect(b, a)).toBe(true)
  })
})

describe('keepLeafMost', () => {
  it('drops a group in favor of its children', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg"><g><path/><path/></g></svg>`)
    const g = root.firstElementChild as Element
    const children = Array.from(g.children)
    expect(keepLeafMost([g, ...children])).toEqual(children)
  })

  it('keeps all elements when none is an ancestor of another', () => {
    const root = parse(`<svg xmlns="http://www.w3.org/2000/svg"><rect/><circle/></svg>`)
    const elements = Array.from(root.children)
    expect(keepLeafMost(elements)).toEqual(elements)
  })

  it('drops nested ancestors at any depth, keeping only the deepest leaf', () => {
    const root = parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><g><g><path/></g></g></svg>`
    )
    const outer = root.firstElementChild as Element
    const inner = outer.firstElementChild as Element
    const leaf = inner.firstElementChild as Element
    expect(keepLeafMost([outer, inner, leaf])).toEqual([leaf])
  })
})
