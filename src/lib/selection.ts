import { parseSvg } from './svgDoc'

export type Selection = { n: number; id: string; label: string; stale: boolean }

export function revalidate(source: string, selections: Selection[]): Selection[] {
  const root = parseSvg(source)
  return selections.map((s) => ({ ...s, stale: !root.querySelector(`#${CSS.escape(s.id)}`) }))
}

export function labelFor(source: string, id: string): string {
  const el = parseSvg(source).querySelector(`#${CSS.escape(id)}`)
  return el?.id || el?.tagName.toLowerCase() || id
}
