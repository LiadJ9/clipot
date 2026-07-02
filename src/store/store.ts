import { create } from 'zustand'
import type { TreeNode } from '../../electron/shared/ipc'
import type { Selection } from '@/lib/selection'
import type { ChatMessage } from '@/lib/promptBuilder'
import type { ProviderId } from '../../electron/services/llm/types'
import type { LlmMessage } from '../../electron/services/llm/types'
import { revalidate } from '@/lib/selection'
import { buildMessages, DEFAULT_RULES } from '@/lib/promptBuilder'
import { createEditParser, IncompleteBlockError } from '@/lib/editStream'
import { applyEdit } from '@/lib/svgDoc'
import { createUndoStack } from '@/lib/undoStack'

// Module-level undo stack, rebound whenever the active document changes.
let undo = createUndoStack('')

// Minimal shape of zustand's setter we need for error reporting.
type SetError = (partial: Partial<State>) => void

// Single place all source-to-disk writes go through, so I/O failures surface as `error`.
async function writeSource(path: string, content: string, set: SetError): Promise<void> {
  try {
    await window.clipot.writeFile(path, content)
  } catch {
    set({ error: 'Failed to save file.' })
  }
}

type Debounced<A extends unknown[]> = ((...args: A) => void) & { cancel(): void; flush(): void }

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: A | null = null
  const run = () => {
    timer = null
    if (lastArgs) {
      const args = lastArgs
      lastArgs = null
      fn(...args)
    }
  }
  const debounced = ((...args: A) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }) as Debounced<A>
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastArgs = null
  }
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      run()
    }
  }
  return debounced
}

// Autosave writes are debounced so rapid edit-block applies don't thrash disk.
const debouncedWrite = debounce((path: string, content: string, set: SetError) => {
  void writeSource(path, content, set)
}, 300)

type State = {
  folder: string | null; tree: TreeNode | null; activePath: string | null
  source: string; selections: Selection[]; thread: ChatMessage[]
  streaming: boolean; activity: string; editCount: { done: number; total: number } | null
  provider: ProviderId; model: string; rules: string; mode: 'edit' | 'new'
  regionImage?: string | null; regionIds?: string[]
  error: string | null
  _stop?: (() => void) | null
  clearError(): void
  addSelection(id: string, label: string): void
  removeSelection(n: number): void
  revalidateSelections(): void
  setSource(s: string): void
  setModel(provider: ProviderId, model: string): void
  setRules(r: string): void
  startNewFile(): void
  openFolder(): Promise<void>
  refreshTree(): Promise<void>
  openFile(path: string): Promise<void>
  sendPrompt(prompt: string): Promise<void>
  stopStream(): void
  undo(): void
  redo(): void
  duplicate(): Promise<void>
  canUndo(): boolean
  canRedo(): boolean
}

export function pathExists(node: TreeNode | null, path: string): boolean {
  if (!node) return false
  if (node.path === path) return true
  return node.children?.some((c) => pathExists(c, path)) ?? false
}

export const useStore = create<State>((set, get) => ({
  folder: null, tree: null, activePath: null,
  source: '', selections: [], thread: [],
  streaming: false, activity: '', editCount: null,
  provider: 'anthropic', model: 'claude-sonnet-5', rules: '', mode: 'edit',
  regionImage: null, regionIds: [], error: null, _stop: null,

  clearError() { set({ error: null }) },
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
  startNewFile() {
    undo = createUndoStack('')
    set({ mode: 'new', activePath: null, source: '', selections: [], thread: [] })
  },

  async openFolder() {
    const folder = await window.clipot.pickFolder()
    if (!folder) return
    const tree = await window.clipot.readTree(folder)
    const rules = (await window.clipot.loadRules(folder)) ?? ''
    set({ folder, tree, rules })
    window.clipot.onTreeChanged(() => get().refreshTree())
  },
  async refreshTree() {
    const f = get().folder
    if (!f) return
    const tree = await window.clipot.readTree(f)
    set({ tree })
    const { activePath } = get()
    if (activePath && !pathExists(tree, activePath)) {
      set({ activePath: null, source: '', selections: [], thread: [] })
    }
  },
  async openFile(path) {
    const source = await window.clipot.readFile(path)
    const thread = get().folder ? await window.clipot.loadThread(get().folder!, path) : []
    undo = createUndoStack(source)
    set({ activePath: path, source, selections: [], thread, mode: 'edit' })
  },

  async sendPrompt(prompt) {
    const st = get()
    if (st.streaming) return
    if (!st.activePath && st.mode !== 'new') return
    const folder = st.folder!
    const rules = st.rules || DEFAULT_RULES
    const priorThread = st.thread
    if (st.activePath) {
      try {
        await window.clipot.checkpoint(folder, st.activePath, st.source, prompt.slice(0, 40))
      } catch {
        set({ error: 'Failed to save checkpoint.' })
      }
    }

    const baseThread: ChatMessage[] = [...priorThread, { role: 'user', content: prompt }]
    set({ streaming: true, activity: '', thread: baseThread, editCount: { done: 0, total: 0 }, error: null })

    const attempt = async (extraNote?: string): Promise<'ok' | 'retry'> => {
      const built = buildMessages({
        source: get().source,
        prompt: extraNote ? `${prompt}\n\n${extraNote}` : prompt,
        selections: get().selections,
        rules,
        history: priorThread,
        regionIds: get().regionIds,
      })
      const messages: LlmMessage[] = built.map((m) => ({ role: m.role, content: m.content }))
      const regionImage = get().regionImage
      if (regionImage && messages.length > 0) {
        const dataBase64 = regionImage.replace(/^data:[^,]*,/, '')
        messages[messages.length - 1].images = [{ mime: 'image/png', dataBase64 }]
      }

      const parser = createEditParser()
      let assistantText = ''
      let failure: { detail: string } | null = null

      await new Promise<void>((resolve) => {
        const stop = window.clipot.startStream(
          { provider: st.provider, model: st.model, messages },
          {
            onChunk: (t: string) => {
              assistantText += t
              set({ activity: assistantText.slice(-120) })
              let blocks
              try {
                blocks = parser.push(t)
              } catch {
                failure = { detail: 'Malformed edit block' }
                return
              }
              for (const b of blocks) {
                const r = applyEdit(get().source, b)
                if (r.ok) {
                  undo.push(r.source)
                  set((s) => ({
                    source: r.source,
                    editCount: {
                      done: (s.editCount?.done ?? 0) + 1,
                      total: (s.editCount?.total ?? 0) + 1,
                    },
                  }))
                  const ap = get().activePath
                  if (ap) debouncedWrite(ap, r.source, set)
                  get().revalidateSelections()
                } else {
                  failure = { detail: r.detail }
                }
              }
            },
            onDone: () => resolve(),
            onError: (msg: string) => {
              failure = { detail: msg }
              resolve()
            },
          },
        )
        set({ _stop: stop })
      })

      try {
        parser.flush()
      } catch (e) {
        if (e instanceof IncompleteBlockError) failure = { detail: 'Incomplete edit block' }
      }
      set((s) => ({ thread: [...s.thread, { role: 'assistant', content: assistantText }] }))
      return failure ? 'retry' : 'ok'
    }

    let result = await attempt()
    for (let i = 0; i < 2 && result === 'retry'; i++) {
      result = await attempt(
        'The previous edit could not be applied (SEARCH text did not match or produced invalid SVG). Re-read the current file and try again.',
      )
    }
    if (result === 'retry') {
      set((s) => ({
        thread: [...s.thread, { role: 'assistant', content: 'Could not apply the requested change after 2 retries.' }],
      }))
    }

    // Guarantee the final streamed edit is on disk before the thread is saved.
    debouncedWrite.flush()
    set({ streaming: false, _stop: null, regionImage: null, regionIds: [] })
    const activePath = get().activePath
    if (activePath) {
      try {
        await window.clipot.saveThread(folder, activePath, get().thread)
      } catch {
        set({ error: 'Failed to save thread.' })
      }
    }
  },

  stopStream() {
    get()._stop?.()
    set({ streaming: false, _stop: null })
  },

  undo() {
    const s = undo.undo()
    if (s !== null) {
      debouncedWrite.cancel() // drop any pending autosave for content we're discarding
      set({ source: s })
      get().revalidateSelections()
      const ap = get().activePath
      if (ap) void writeSource(ap, s, set)
    }
  },
  redo() {
    const s = undo.redo()
    if (s !== null) {
      debouncedWrite.cancel() // drop any pending autosave for content we're discarding
      set({ source: s })
      get().revalidateSelections()
      const ap = get().activePath
      if (ap) void writeSource(ap, s, set)
    }
  },
  async duplicate() {
    const ap = get().activePath
    if (ap) {
      try {
        await window.clipot.duplicate(ap)
        await get().refreshTree()
      } catch {
        set({ error: 'Failed to duplicate file.' })
      }
    }
  },
  canUndo: () => undo.canUndo(),
  canRedo: () => undo.canRedo(),
}))
