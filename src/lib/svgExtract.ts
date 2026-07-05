// Recover a complete <svg>…</svg> string from arbitrary model text (fenced or
// bare). Text-only — does not validate SVG semantics; callers should parse it.
export function extractSvg(text: string): string | null {
  const fence = /```(?:svg|xml|html)?\s*\n?([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = fence.exec(text)) !== null) {
    const svg = sliceSvg(m[1])
    if (svg) return svg
  }
  return sliceSvg(text)
}

function sliceSvg(s: string): string | null {
  const start = s.search(/<svg[\s>]/i)
  if (start < 0) return null
  const end = s.toLowerCase().lastIndexOf('</svg>')
  if (end < start) return null
  return s.slice(start, end + '</svg>'.length).trim()
}
