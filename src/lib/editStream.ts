export type EditBlock =
  | { kind: 'edit'; search: string; replace: string }
  | { kind: 'file'; content: string }

export class IncompleteBlockError extends Error {}

const OPEN_EDIT = '<<<EDIT'
const OPEN_FILE = '<<<FILE'
const CLOSE = '>>>'

export function createEditParser() {
  let buf = ''

  function tryExtract(): EditBlock | null {
    const editIdx = buf.indexOf(OPEN_EDIT)
    const fileIdx = buf.indexOf(OPEN_FILE)
    const candidates = [editIdx, fileIdx].filter((i) => i >= 0)
    if (candidates.length === 0) return null
    const start = Math.min(...candidates)
    const close = buf.indexOf(CLOSE, start)
    if (close < 0) return null // block not finished yet
    const raw = buf.slice(start, close)
    buf = buf.slice(close + CLOSE.length)

    if (raw.startsWith(OPEN_EDIT)) {
      const m = /<<<EDIT\s*\nSEARCH:\s*\n([\s\S]*?)\nREPLACE:\s*\n([\s\S]*?)\n?$/.exec(raw)
      if (!m) throw new IncompleteBlockError('Malformed EDIT block')
      return { kind: 'edit', search: m[1], replace: m[2] }
    }
    const fm = /<<<FILE\s*\n([\s\S]*?)\n?$/.exec(raw)
    if (!fm) throw new IncompleteBlockError('Malformed FILE block')
    return { kind: 'file', content: fm[1] }
  }

  return {
    push(chunk: string): EditBlock[] {
      buf += chunk
      const out: EditBlock[] = []
      let b: EditBlock | null
      while ((b = tryExtract()) !== null) out.push(b)
      return out
    },
    flush(): EditBlock[] {
      if (buf.includes(OPEN_EDIT) || buf.includes(OPEN_FILE)) {
        throw new IncompleteBlockError('Stream ended mid-block')
      }
      buf = ''
      return []
    },
  }
}
