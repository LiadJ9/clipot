import type { ChatMessage } from '@/lib/promptBuilder'

export function promptHistory(thread: ChatMessage[]): string[] {
  return thread.filter((m) => m.role === 'user').map((m) => m.content).slice(-50)
}

export type HistNav = { index: number | null; text: string }

// Pure navigation over a NON-EMPTY history. index null = editing the draft.
export function navigateHistory(
  history: string[],
  index: number | null,
  draft: string,
  dir: 'up' | 'down',
): HistNav {
  if (dir === 'up') {
    if (index === null) return { index: history.length - 1, text: history[history.length - 1] }
    const next = Math.max(0, index - 1)
    return { index: next, text: history[next] }
  }
  if (index === null || index >= history.length - 1) return { index: null, text: draft }
  const next = index + 1
  return { index: next, text: history[next] }
}
