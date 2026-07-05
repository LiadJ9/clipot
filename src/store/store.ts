import { create } from 'zustand'
import type { TreeNode, Prefs } from '../../electron/shared/ipc'
import type { Selection } from '@/lib/selection'
import type { ChatMessage } from '@/lib/promptBuilder'
import type { ProviderId } from '../../electron/services/llm/types'
import type { LlmMessage } from '../../electron/services/llm/types'
import { revalidate } from '@/lib/selection'
import { buildMessages, DEFAULT_RULES } from '@/lib/promptBuilder'
import { createEditParser } from '@/lib/editStream'
import { applyEdit } from '@/lib/svgDoc'
import { extractSvg } from '@/lib/svgExtract'
import { createUndoStack } from '@/lib/undoStack'

// Module-level undo stack, rebound whenever the active document changes.
let undo = createUndoStack('')

// Best-effort persistence of non-secret session prefs (provider/model/folder/active file).
function persistPrefs(s: { provider: ProviderId; model: string; folder: string | null; activePath: string | null }) {
  try {
    void window.clipot.savePrefs({
      provider: s.provider,
      model: s.model,
      folder: s.folder ?? undefined,
      activePath: s.activePath ?? undefined,
    })
  } catch {
    // prefs are non-critical; ignore failures
  }
}

// Watch + read a folder's tree and rules. Shared by opening a folder and restoring one on boot.
async function fetchFolder(folder: string): Promise<{ tree: TreeNode; rules: string }> {
  await window.clipot.watchFolder(folder)
  const tree = await window.clipot.readTree(folder)
  const rules = (await window.clipot.loadRules(folder)) ?? ''
  return { tree, rules }
}

// Human-readable provider names for user-facing error messages.
const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
}

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
  suggestedName: string | null
  provider: ProviderId; model: string; rules: string; mode: 'edit' | 'new'
  regionImage?: string | null; regionIds?: string[]
  regionMode: boolean; threadOpen: boolean
  zoom: number
  error: string | null
  _stop?: (() => void) | null
  clearError(): void
  addSelection(id: string, label: string): void
  removeSelection(n: number): void
  revalidateSelections(): void
  setSource(s: string): void
  rollbackTo(content: string): void
  setModel(provider: ProviderId, model: string): void
  setRules(r: string): void
  toggleRegionMode(): void
  toggleThread(): void
  zoomIn(): void
  zoomOut(): void
  zoomReset(): void
  startNewFile(): void
  init(): Promise<void>
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
  streaming: false, activity: '', editCount: null, suggestedName: null,
  provider: 'anthropic', model: 'claude-sonnet-5', rules: '', mode: 'edit',
  regionImage: null, regionIds: [], regionMode: false, threadOpen: false, zoom: 1, error: null, _stop: null,

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
  rollbackTo(content) {
    debouncedWrite.cancel() // drop any pending autosave for content we're discarding
    undo = createUndoStack(content)
    set({ source: content })
    get().revalidateSelections()
    const ap = get().activePath
    if (ap) void writeSource(ap, content, set)
  },
  setModel(provider, model) { set({ provider, model }); persistPrefs(get()) },
  setRules(r) { set({ rules: r }) },
  toggleRegionMode() { set((s) => ({ regionMode: !s.regionMode })) },
  toggleThread() { set((s) => ({ threadOpen: !s.threadOpen })) },
  zoomIn() { set((s) => ({ zoom: Math.min(4, +(s.zoom * 1.2).toFixed(3)) })) },
  zoomOut() { set((s) => ({ zoom: Math.max(0.25, +(s.zoom / 1.2).toFixed(3)) })) },
  zoomReset() { set({ zoom: 1 }) },
  startNewFile() {
    undo = createUndoStack('')
    set({ mode: 'new', activePath: null, source: '', selections: [], thread: [] })
    persistPrefs(get())
  },

  async init() {
    let p: Prefs
    try {
      p = await window.clipot.loadPrefs()
    } catch {
      return
    }
    if (p.provider && p.model) set({ provider: p.provider, model: p.model })
    if (p.folder) {
      try {
        const { tree, rules } = await fetchFolder(p.folder)
        set({ folder: p.folder, tree, rules })
        window.clipot.onTreeChanged(() => get().refreshTree())
        if (p.activePath && pathExists(tree, p.activePath)) {
          await get().openFile(p.activePath)
        }
      } catch {
        // Saved folder is gone/inaccessible — start fresh without it.
      }
    }
  },
  async openFolder() {
    const folder = await window.clipot.pickFolder()
    if (!folder) return
    const { tree, rules } = await fetchFolder(folder)
    undo = createUndoStack('')
    set({ folder, tree, rules, activePath: null, source: '', selections: [], thread: [], mode: 'edit' })
    window.clipot.onTreeChanged(() => get().refreshTree())
    persistPrefs(get())
  },
  async refreshTree() {
    const f = get().folder
    if (!f) return
    const tree = await window.clipot.readTree(f)
    set({ tree })
    const { activePath } = get()
    if (activePath && !pathExists(tree, activePath)) {
      set({ activePath: null, source: '', selections: [], thread: [] })
      persistPrefs(get())
    }
  },
  async openFile(path) {
    const source = await window.clipot.readFile(path)
    const thread = get().folder ? await window.clipot.loadThread(get().folder!, path) : []
    undo = createUndoStack(source)
    set({ activePath: path, source, selections: [], thread, mode: 'edit' })
    persistPrefs(get())
  },

  async sendPrompt(prompt) {
    const st = get()
    if (st.streaming) return
    // Proceed when editing an open file OR creating into an open folder (the
    // new-file screen shows for both mode 'new' and an empty folder in 'edit').
    if (!st.activePath && !st.folder) return

    // Fail fast if the chosen provider has no key (Ollama uses a local host, so
    // it needs none). Avoids a pointless checkpoint + stream + retry cycle and
    // gives the user an actionable message instead of a generic edit failure.
    if (st.provider !== 'ollama') {
      let hasKey = true
      try {
        hasKey = !!(await window.clipot.keyStatus())[st.provider]
      } catch {
        hasKey = true // status check failed; let the stream error path report any real problem
      }
      if (!hasKey) {
        set({ error: `No API key set for ${PROVIDER_LABELS[st.provider]}. Add one in Settings.` })
        return
      }
    }

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
    set({ streaming: true, activity: '', thread: baseThread, editCount: { done: 0, total: 0 }, error: null, suggestedName: null })

    type AttemptResult = { kind: 'ok' } | { kind: 'retry' } | { kind: 'error'; message: string }
    const attempt = async (extraNote?: string): Promise<AttemptResult> => {
      const built = buildMessages({
        source: get().source,
        prompt: extraNote ? `${prompt}\n\n${extraNote}` : prompt,
        selections: get().selections,
        rules,
        history: priorThread.filter((m) => !m.error), // never resend failure notices as context
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
      let appliedCount = 0
      let streamError: string | null = null

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
                  appliedCount++
                  if (b.kind === 'file' && b.name) set({ suggestedName: b.name })
                }
              }
            },
            onDone: () => resolve(),
            onError: (msg: string) => {
              streamError = msg
              resolve()
            },
          },
        )
        set({ _stop: stop })
      })

      try {
        parser.flush()
      } catch {}

      // Fallback: the model produced no applicable blocks and no provider error,
      // but may have returned an SVG in prose/a code fence. Recover and apply it
      // as a whole-document result (validated by applyEdit's FILE path).
      if (appliedCount === 0 && !streamError) {
        const svg = extractSvg(assistantText)
        if (svg) {
          const r = applyEdit(get().source, { kind: 'file', content: svg })
          if (r.ok) {
            undo.push(r.source)
            set((s) => ({
              source: r.source,
              editCount: { done: (s.editCount?.done ?? 0) + 1, total: (s.editCount?.total ?? 0) + 1 },
            }))
            const ap = get().activePath
            if (ap) debouncedWrite(ap, r.source, set)
            get().revalidateSelections()
            appliedCount++
          }
        }
      }

      if (assistantText.trim()) {
        set((s) => ({ thread: [...s.thread, { role: 'assistant', content: assistantText }] }))
      }
      if (streamError) return { kind: 'error', message: streamError }
      return appliedCount > 0 ? { kind: 'ok' } : { kind: 'retry' }
    }

    let result = await attempt()
    // Only edit-apply failures are retried; a stream/provider error (bad key,
    // auth, network) won't be fixed by retrying, so it exits the loop at once.
    for (let i = 0; i < 2 && result.kind === 'retry'; i++) {
      result = await attempt(
        'Your previous reply applied no change. Return SVG ONLY inside a <<<FILE>>> block (for a new document) or <<<EDIT>>> blocks (to modify) — never in prose or code fences.',
      )
    }
    if (result.kind === 'error') {
      const msg = result.message
      const isNoKey = /no api key/i.test(msg)
      // Full provider error goes into the message log (scrollable); the activity
      // strip only gets a short pointer since it's space-limited.
      set((s) => ({
        thread: [
          ...s.thread,
          { role: 'assistant', content: `${PROVIDER_LABELS[st.provider]} request failed:\n${msg}`, error: true },
        ],
        error: isNoKey
          ? `No API key set for ${PROVIDER_LABELS[st.provider]}. Add one in Settings.`
          : `${PROVIDER_LABELS[st.provider]} request failed — see the message log.`,
        threadOpen: true, // reveal the log so the full error is visible immediately
      }))
    } else if (result.kind === 'retry') {
      set((s) => ({
        thread: [
          ...s.thread,
          { role: 'assistant', content: "The model didn't return an SVG in an applicable format. Try rephrasing your request.", error: true },
        ],
        error: "The model didn't return an SVG in an applicable format — see the message log.",
        threadOpen: true,
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
