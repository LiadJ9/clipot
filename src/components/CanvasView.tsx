import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { ensureId } from '@/lib/svgDoc'
import { labelFor } from '@/lib/selection'

type Bubble = { n: number; x: number; y: number }

function sanitize(root: SVGSVGElement) {
  root.querySelectorAll('script').forEach((n) => n.remove())
  root.querySelectorAll('*').forEach((el) => {
    for (const a of Array.from(el.attributes)) if (a.name.startsWith('on')) el.removeAttribute(a.name)
  })
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

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = ''
    if (!source) return
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
    const root = doc.documentElement as unknown as SVGSVGElement
    if (root.tagName.toLowerCase() !== 'svg') return
    sanitize(root)
    host.appendChild(root)

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (target === root) return
      e.stopPropagation()
      const existing = target.id ? useStore.getState().selections.find((s) => s.id === target.id) : undefined
      if (existing) { removeSelection(existing.n); return }
      const p = pathTo(root, target)
      const { source: next, id } = ensureId(source, p)
      if (next !== source) setSource(next)
      addSelection(id, labelFor(next, id))
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [source, addSelection, removeSelection, setSource])

  // overlay: re-mark selected elements each render
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const root = host.querySelector('svg')
    if (!root) return
    root.querySelectorAll('[data-clipot-overlay]').forEach((n) => n.remove())
    selections.forEach((s) => {
      const el = root.querySelector(`#${CSS.escape(s.id)}`)
      if (!el) return
      const clone = el.cloneNode(true) as SVGElement
      clone.setAttribute('data-clipot-overlay', '1')
      clone.setAttribute('stroke', '#fff')
      clone.setAttribute('stroke-width', '2')
      clone.setAttribute('style', 'filter: drop-shadow(0 0 4px rgba(255,255,255,.9))')
      root.appendChild(clone)
    })
  }, [selections, source])

  // numbered bubbles: position an HTML badge over each selected element's bbox
  useEffect(() => {
    const recompute = () => {
      const host = hostRef.current
      const wrap = wrapRef.current
      const root = host?.querySelector('svg') ?? null
      if (!host || !wrap || !root) { setBubbles([]); return }
      const wrapRect = wrap.getBoundingClientRect()
      const next: Bubble[] = []
      for (const s of selections) {
        const el = root.querySelector(`#${CSS.escape(s.id)}`)
        const p = el && bboxScreenPoint(root, el)
        if (p) next.push({ n: s.n, x: p.x - wrapRect.left, y: p.y - wrapRect.top })
      }
      setBubbles(next)
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [selections, source])

  return (
    <div className="canvas-wrap" data-testid="canvas" ref={wrapRef}>
      <div className="surface" ref={hostRef} style={{ padding: 12, maxWidth: '90%', maxHeight: '90%' }} />
      {bubbles.map((b) => <Bubble key={b.n} {...b} />)}
    </div>
  )
}
