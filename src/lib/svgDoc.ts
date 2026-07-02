export class SvgParseError extends Error {}

export function parseSvg(source: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new SvgParseError(err.textContent ?? 'Invalid SVG')
  const root = doc.documentElement
  if (!root || root.tagName.toLowerCase() !== 'svg') throw new SvgParseError('Root element is not <svg>')
  return root as unknown as SVGSVGElement
}

export function serializeSvg(el: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(el)
}

export function nextClipotId(root: Element): string {
  let max = 0
  root.querySelectorAll('[id]').forEach((el) => {
    const m = /^clipot-(\d+)$/.exec(el.id)
    if (m) max = Math.max(max, Number(m[1]))
  })
  return `clipot-${max + 1}`
}

function elementAtPath(root: Element, path: number[]): Element {
  let cur: Element = root
  for (const i of path) {
    const child = cur.children[i]
    if (!child) throw new SvgParseError(`No element at path ${path.join('/')}`)
    cur = child
  }
  return cur
}

export function ensureId(source: string, targetPath: number[]): { source: string; id: string } {
  const root = parseSvg(source)
  const el = elementAtPath(root, targetPath)
  if (el.id) return { source, id: el.id }
  const id = nextClipotId(root)
  el.setAttribute('id', id)
  return { source: serializeSvg(root as unknown as SVGSVGElement), id }
}
