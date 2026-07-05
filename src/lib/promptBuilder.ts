import { parseSvg } from './svgDoc'
import type { Selection } from './selection'

// `error` marks a display-only failure notice in the thread log; such messages
// are shown to the user but never sent back to the model as conversation history.
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string; error?: boolean }

export const SIZE_CAP = 32 * 1024

export const EDIT_PROTOCOL = [
  'You edit SVG files. Reply with a short explanation plus edit blocks.',
  'To change an existing file, emit one or more blocks of exactly this form:',
  '<<<EDIT',
  'SEARCH:',
  '<exact text copied from the current file>',
  'REPLACE:',
  '<replacement text>',
  '>>>',
  'SEARCH must match the current file byte-for-byte. Prefer minimal edits.',
  'To create a brand-new file, emit a single block:',
  '<<<FILE',
  '<the complete <svg>...</svg> document>',
  '>>>',
].join('\n')

export const DEFAULT_RULES = [
  'Produce distinct, well-separated elements with meaningful id attributes.',
  'Keep structure human-readable.',
  'Never remove or rename existing id attributes.',
  'Prefer minimal edits over full rewrites.',
].join('\n')

const HISTORY_BUDGET = 8000 // approx tokens
const approxTokens = (s: string) => Math.ceil(s.length / 4)

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = []
  let used = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const t = approxTokens(history[i].content)
    if (used + t > HISTORY_BUDGET) break
    used += t
    out.unshift(history[i])
  }
  return out
}

function elementSource(source: string, id: string): string {
  const el = parseSvg(source).querySelector(`#${CSS.escape(id)}`)
  return el ? new XMLSerializer().serializeToString(el) : `(missing #${id})`
}

function sourceContext(source: string, mentionedIds: string[]): string {
  if (source.length <= SIZE_CAP) return `Current SVG:\n${source}`
  const root = parseSvg(source)
  const skeleton = `<svg ${Array.from(root.attributes).map((a) => `${a.name}="${a.value}"`).join(' ')}>…</svg>`
  const parts = mentionedIds.map((id) => elementSource(source, id))
  return `SVG is large; skeleton:\n${skeleton}\nMentioned elements:\n${parts.join('\n')}`
}

export function buildMessages(args: {
  source: string
  prompt: string
  selections: Selection[]
  rules: string
  history: ChatMessage[]
  regionIds?: string[]
}): ChatMessage[] {
  const { source, prompt, selections, rules, history, regionIds } = args
  const system: ChatMessage = { role: 'system', content: `${EDIT_PROTOCOL}\n\nProject rules:\n${rules}` }

  let expanded = prompt
  const mentioned: string[] = []
  for (const s of selections) {
    mentioned.push(s.id)
    const src = elementSource(source, s.id)
    expanded = expanded.replaceAll(`@${s.n}`, `#${s.id} (${s.label})`)
    expanded += `\n\nElement @${s.n} = #${s.id}:\n${src}`
  }
  if (regionIds?.length) {
    expanded += `\n\nRegion covers elements: ${regionIds.map((i) => `#${i}`).join(', ')}`
  }
  const user: ChatMessage = { role: 'user', content: `${expanded}\n\n${sourceContext(source, mentioned)}` }

  return [system, ...trimHistory(history), user]
}
