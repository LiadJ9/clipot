import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { ensureId } from '@/lib/svgDoc'
import { labelFor, type Selection } from '@/lib/selection'

type Bubble = { n: number; x: number; y: number }

export function sanitize(root: SVGSVGElement) {
  root.querySelectorAll('script').forEach((n) => n.remove())
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const a of Array.from(el.attributes)) if (a.name.startsWith('on')) el.removeAttribute(a.name)
  }
}

function pathTo(root: Element, el: Element): number[] {
  const path: number[] = []
  let cur = el
  while (cur !== root && cur.parentElement) {
    path.unshift(Array.prototype.indexOf.call(cur.parentElement.children, cur))
    cur = cur.parentElement
  }
  return path
}

// Top-left of an element's bbox, in viewport (client) coordinates.
function bboxScreenPoint(root: SVGSVGElement, el: Element): { x: number; y: number } | null {
  if (!('getBBox' in el) || !('getScreenCTM' in el)) return null
  const ge = el as unknown as SVGGraphicsElement
  try {
    const ctm = ge.getScreenCTM()
    if (!ctm) return null
    const bbox = ge.getBBox()
    const pt = root.createSVGPoint()
    pt.x = bbox.x
    pt.y = bbox.y
    const p = pt.matrixTransform(ctm)
    return { x: p.x, y: p.y }
  } catch {
    return null
  }
}

function Bubble({ n, x, y }: Bubble) {
  return <span className="sel-bubble" style={{ left: x, top: y }}>{n}</span>
}

export default function CanvasView() {
  const { source, selections, addSelection, removeSelection, setSource } = useStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])

  // Rebuild the DOM from source, wire clicks, highlight selections in place,
  // and position bubbles — all in one pass so there's no stale state to clean up.
  useEffect(() => {
    const host = hostRef.current
    const wrap = wrapRef.current
    if (!host) return
    host.innerHTML = ''
    if (!source) { setBubbles([]); return }
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
    const root = doc.documentElement as unknown as SVGSVGElement
    if (root.tagName.toLowerCase() !== 'svg') { setBubbles([]); return }
    sanitize(root)
    host.appendChild(root)

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (target === root) return
      e.stopPropagation()
      let matched: Selection | undefined
      let cur: Element | null = target
      while (cur && cur !== root) {
        if (cur.id) {
          matched = selections.find((s) => s.id === cur!.id)
          if (matched) break
        }
        cur = cur.parentElement
      }
      if (matched) { removeSelection(matched.n); return }
      const p = pathTo(root, target)
      const { source: next, id } = ensureId(source, p)
      if (next !== source) setSource(next)
      addSelection(id, labelFor(next, id))
    }
    root.addEventListener('click', onClick)

    for (const s of selections) {
      if (s.stale) continue
      const el = root.querySelector(`#${CSS.escape(s.id)}`)
      if (!el) continue
      el.setAttribute('stroke', '#fff')
      el.setAttribute('stroke-width', '2')
      el.setAttribute('style', 'filter: drop-shadow(0 0 4px rgba(255,255,255,.9))')
      el.parentNode?.appendChild(el)
    }

    const recomputeBubbles = () => {
      if (!wrap) { setBubbles([]); return }
      const wrapRect = wrap.getBoundingClientRect()
      const next: Bubble[] = []
      for (const s of selections) {
        const el = root.querySelector(`#${CSS.escape(s.id)}`)
        const p = el && bboxScreenPoint(root, el)
        if (p) next.push({ n: s.n, x: p.x - wrapRect.left, y: p.y - wrapRect.top })
      }
      setBubbles(next)
    }
    recomputeBubbles()
    window.addEventListener('resize', recomputeBubbles)

    return () => {
      root.removeEventListener('click', onClick)
      window.removeEventListener('resize', recomputeBubbles)
    }
  }, [source, selections, addSelection, removeSelection, setSource])

  return (
    <div className="canvas-wrap" data-testid="canvas" ref={wrapRef}>
      <div className="surface" ref={hostRef} style={{ padding: 12, maxWidth: '90%', maxHeight: '90%' }} />
      {bubbles.map((b) => <Bubble key={b.n} {...b} />)}
    </div>
  )
}
