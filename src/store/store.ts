import { create } from 'zustand'
import type { TreeNode } from '../../electron/shared/ipc'
import type { Selection } from '@/lib/selection'
import type { ChatMessage } from '@/lib/promptBuilder'
import type { ProviderId } from '../../electron/services/llm/types'
import { revalidate } from '@/lib/selection'

type State = {
  folder: string | null; tree: TreeNode | null; activePath: string | null
  source: string; selections: Selection[]; thread: ChatMessage[]
  streaming: boolean; activity: string; editCount: { done: number; total: number } | null
  provider: ProviderId; model: string; rules: string; mode: 'edit' | 'new'
  addSelection(id: string, label: string): void
  removeSelection(n: number): void
  revalidateSelections(): void
  setSource(s: string): void
  setModel(provider: ProviderId, model: string): void
  setRules(r: string): void
  startNewFile(): void
}

export const useStore = create<State>((set, get) => ({
  folder: null, tree: null, activePath: null,
  source: '', selections: [], thread: [],
  streaming: false, activity: '', editCount: null,
  provider: 'anthropic', model: 'claude-sonnet-5', rules: '', mode: 'edit',

  addSelection(id, label) {
    const sel = get().selections
    if (sel.some((s) => s.id === id)) return
    set({ selections: [...sel, { n: sel.length + 1, id, label, stale: false }] })
  },
  removeSelection(n) {
    const kept = get().selections.filter((s) => s.n !== n)
    set({ selections: kept.map((s, i) => ({ ...s, n: i + 1 })) })
  },
  revalidateSelections() {
    set({ selections: revalidate(get().source, get().selections) })
  },
  setSource(s) { set({ source: s }) },
  setModel(provider, model) { set({ provider, model }) },
  setRules(r) { set({ rules: r }) },
  startNewFile() { set({ mode: 'new', activePath: null, source: '', selections: [], thread: [] }) },
}))
