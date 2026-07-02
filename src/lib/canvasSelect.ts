import type { Selection } from './selection'

export type ClickAction =
  | { kind: 'deselect'; n: number }
  | { kind: 'select'; path: number[] }
  | { kind: 'none' }

export const PATH_ATTR = 'data-clipot-path'

// Stamps every descendant of root with its original child-index path from
// root, so clicks can be mapped back even after live-DOM reordering.
export function stampPaths(root: Element): void {
  const walk = (el: Element, path: number[]) => {
    Array.from(el.children).forEach((child, i) => {
      const childPath = [...path, i]
      child.setAttribute(PATH_ATTR, childPath.join('/'))
      walk(child, childPath)
    })
  }
  walk(root, [])
}

export function resolveClick(root: Element, target: Element, selections: Selection[]): ClickAction {
  if (target === root) return { kind: 'none' }

  let cur: Element | null = target
  while (cur && cur !== root) {
    if (cur.id) {
      const matched = selections.find((s) => s.id === cur!.id)
      if (matched) return { kind: 'deselect', n: matched.n }
    }
    cur = cur.parentElement
  }

  const stamped = target.closest(`[${PATH_ATTR}]`)
  if (!stamped) return { kind: 'none' }
  const attr = stamped.getAttribute(PATH_ATTR)
  if (!attr) return { kind: 'none' }
  const path = attr.split('/').map(Number)
  return { kind: 'select', path }
}

export type Rect = { left: number; top: number; right: number; bottom: number }

// Strict inequalities: rects that only touch at an edge don't "intersect" (zero overlap area).
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

// Drops any element that is an ancestor of another element in the list, so a
// container and its children never both survive (matches click-select granularity).
export function keepLeafMost(elements: Element[]): Element[] {
  return elements.filter((e) => !elements.some((f) => e !== f && e.contains(f)))
}
