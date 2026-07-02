import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useStore } from '@/store/store'
import { ensureId } from '@/lib/svgDoc'
import { labelFor } from '@/lib/selection'
import { resolveClick, stampPaths, rectsIntersect, keepLeafMost, PATH_ATTR, type Rect } from '@/lib/canvasSelect'

type Bubble = { n: number; x: number; y: number }
type DragRect = { x0: number; y0: number; x1: number; y1: number }

const MIN_DRAG_PX = 3

// A gesture only counts as a drag (vs. a plain click) once it clears MIN_DRAG_PX
// on at least one axis.
function isRealDrag(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  return Math.abs(end.x - start.x) >= MIN_DRAG_PX || Math.abs(end.y - start.y) >= MIN_DRAG_PX
}

export function sanitize(root: SVGSVGElement) {
  root.querySelectorAll('script').forEach((n) => n.remove())
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const a of Array.from(el.attributes)) if (a.name.startsWith('on')) el.removeAttribute(a.name)
  }
}

// Top-left of an element's bbox, in viewport (client) coordinates.
function bboxScreenPoint(root: SVGSVGElement, el: Element): { x: number; y: number } | null {
  if (!('getBBox' in el) || !('getScreenCTM' in el)) return null
  const ge = el as SVGGraphicsElement
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

// Screen-space bounding rect of an element's bbox, in viewport (client) coordinates.
function elementScreenRect(root: SVGSVGElement, el: Element): Rect | null {
  if (!('getBBox' in el) || !('getScreenCTM' in el)) return null
  const ge = el as SVGGraphicsElement
  try {
    const ctm = ge.getScreenCTM()
    if (!ctm) return null
    const bbox = ge.getBBox()
    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    ]
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const c of corners) {
      const pt = root.createSVGPoint()
      pt.x = c.x
      pt.y = c.y
      const p = pt.matrixTransform(ctm)
      left = Math.min(left, p.x)
      top = Math.min(top, p.y)
      right = Math.max(right, p.x)
      bottom = Math.max(bottom, p.y)
    }
    return { left, top, right, bottom }
  } catch {
    return null
  }
}

// Rasterizes `svgSource` and crops to `dragBox` (client coords), using `root`'s current
// on-screen bounding rect to map screen coords into the rendered SVG's pixel box.
// Never throws: any failure (load/security/taint) clears regionImage and sets a short error.
async function rasterizeRegion(svgSource: string, dragBox: Rect, root: SVGSVGElement): Promise<void> {
  try {
    const svgRect = root.getBoundingClientRect()
    const left = Math.max(dragBox.left, svgRect.left)
    const top = Math.max(dragBox.top, svgRect.top)
    const right = Math.min(dragBox.right, svgRect.right)
    const bottom = Math.min(dragBox.bottom, svgRect.bottom)
    const width = right - left
    const height = bottom - top
    if (width <= 0 || height <= 0 || svgRect.width <= 0 || svgRect.height <= 0) {
      useStore.setState({ regionImage: null })
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          const full = document.createElement('canvas')
          full.width = Math.round(svgRect.width)
          full.height = Math.round(svgRect.height)
          const fullCtx = full.getContext('2d')
          if (!fullCtx) { reject(new Error('No 2D context')); return }
          fullCtx.drawImage(img, 0, 0, full.width, full.height)

          const crop = document.createElement('canvas')
          crop.width = Math.round(width)
          crop.height = Math.round(height)
          const cropCtx = crop.getContext('2d')
          if (!cropCtx) { reject(new Error('No 2D context')); return }
          cropCtx.drawImage(full, left - svgRect.left, top - svgRect.top, width, height, 0, 0, width, height)
          resolve(crop.toDataURL('image/png'))
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Rasterization failed'))
        }
      }
      img.onerror = () => reject(new Error('Failed to load SVG for rasterization'))
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSource)}`
    })

    useStore.setState({ regionImage: dataUrl })
  } catch {
    useStore.setState({ regionImage: null, error: 'Failed to capture region image.' })
  }
}

function Bubble({ n, x, y }: Bubble) {
  return <span className="sel-bubble" style={{ left: x, top: y }}>{n}</span>
}

export default function CanvasView() {
  const { source, selections, addSelection, removeSelection, setSource, regionMode } = useStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<SVGSVGElement | null>(null)
  const suppressClickRef = useRef(false)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [dragRect, setDragRect] = useState<DragRect | null>(null)

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
    stampPaths(root)
    host.appendChild(root)
    rootRef.current = root

    const onClick = (e: MouseEvent) => {
      if (suppressClickRef.current) { suppressClickRef.current = false; return }
      if (useStore.getState().regionMode) return
      const target = e.target as Element
      const action = resolveClick(root, target, selections)
      if (action.kind === 'none') return
      e.stopPropagation()
      if (action.kind === 'deselect') { removeSelection(action.n); return }
      const { source: next, id } = ensureId(source, action.path)
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

  // Finds every stamped element intersecting the drag rect, ensures each has an id,
  // adds it as a selection, then kicks off (async, best-effort) rasterization of the crop.
  function finishRegionDrag(start: { x: number; y: number }, end: { x: number; y: number }) {
    const root = rootRef.current
    useStore.setState({ regionMode: false })
    if (!root) return

    const dragBox: Rect = {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      right: Math.max(start.x, end.x),
      bottom: Math.max(start.y, end.y),
    }
    if (!isRealDrag(start, end)) return

    const intersecting: Element[] = []
    for (const el of Array.from(root.querySelectorAll(`[${PATH_ATTR}]`))) {
      const rect = elementScreenRect(root, el)
      if (rect && rectsIntersect(dragBox, rect)) intersecting.push(el)
    }
    const leafMost = keepLeafMost(intersecting)

    const { source: startSource, addSelection: addSel, setSource: setSrc } = useStore.getState()
    let currentSource = startSource
    const ids: string[] = []

    for (const el of leafMost) {
      const attr = el.getAttribute(PATH_ATTR)
      if (!attr) continue
      const path = attr.split('/').map(Number)
      const { source: next, id } = ensureId(currentSource, path)
      if (next !== currentSource) {
        currentSource = next
        setSrc(next)
      }
      addSel(id, labelFor(currentSource, id))
      ids.push(id)
    }

    useStore.setState({ regionIds: ids })
    void rasterizeRegion(currentSource, dragBox, root)
  }

  function handleMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (!regionMode) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    setDragRect({ x0: start.x, y0: start.y, x1: start.x, y1: start.y })

    const onMove = (ev: MouseEvent) => {
      setDragRect({ x0: start.x, y0: start.y, x1: ev.clientX, y1: ev.clientY })
    }
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const end = { x: ev.clientX, y: ev.clientY }
      setDragRect(null)
      if (isRealDrag(start, end)) {
        suppressClickRef.current = true
        // Self-clearing: a synthetic click (if any) fires synchronously before this
        // macrotask, so the flag can never persist past the current gesture.
        setTimeout(() => { suppressClickRef.current = false }, 0)
      }
      finishRegionDrag(start, end)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const wrapRect = dragRect && wrapRef.current?.getBoundingClientRect()
  const overlay = dragRect && wrapRect ? {
    left: Math.min(dragRect.x0, dragRect.x1) - wrapRect.left,
    top: Math.min(dragRect.y0, dragRect.y1) - wrapRect.top,
    width: Math.abs(dragRect.x1 - dragRect.x0),
    height: Math.abs(dragRect.y1 - dragRect.y0),
  } : null

  return (
    <div className="canvas-wrap" data-testid="canvas" ref={wrapRef} onMouseDown={handleMouseDown}>
      <div className="surface" ref={hostRef} style={{ padding: 12, maxWidth: '90%', maxHeight: '90%' }} />
      {bubbles.map((b) => <Bubble key={b.n} {...b} />)}
      {overlay && <div className="region-drag-rect" style={overlay} />}
    </div>
  )
}
