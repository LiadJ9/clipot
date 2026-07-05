import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useStore, pathExists } from '@/store/store'
import type { TreeNode } from '../../electron/shared/ipc'

beforeEach(() => useStore.setState({ selections: [], source: '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>' }))

describe('store selections', () => {
  it('adds a selection with the next number', () => {
    useStore.getState().addSelection('clipot-1', 'rect')
    expect(useStore.getState().selections).toEqual([{ n: 1, id: 'clipot-1', label: 'rect', stale: false }])
  })
  it('does not add the same id twice', () => {
    useStore.getState().addSelection('clipot-1', 'rect')
    useStore.getState().addSelection('clipot-1', 'rect')
    expect(useStore.getState().selections.length).toBe(1)
  })
  it('removes and renumbers', () => {
    const s = useStore.getState()
    s.addSelection('a', 'a'); s.addSelection('b', 'b'); s.removeSelection(1)
    expect(useStore.getState().selections.map((x) => [x.n, x.id])).toEqual([[1, 'b']])
  })
})

describe('sendPrompt', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>'
  const editReply = '<<<EDIT\nSEARCH:\n<rect id="clipot-1"/>\nREPLACE:\n<rect id="clipot-1" fill="blue"/>\n>>>'

  it('streams an edit block, applies it live, updates thread, and clears region state', async () => {
    const saveThread = vi.fn().mockResolvedValue(undefined)
    const stop = vi.fn()
    const startStream = vi.fn((_args, h) => { h.onChunk(editReply); h.onDone(); return stop })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
      checkpoint: vi.fn().mockResolvedValue('cp'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      saveThread,
      startStream,
    }
    useStore.setState({
      folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit',
      provider: 'anthropic', regionImage: 'data:image/png;base64,AAA', regionIds: ['clipot-1'],
    })

    await useStore.getState().sendPrompt('make it blue')

    const s = useStore.getState()
    expect(s.source).toContain('fill="blue"')
    expect(s.editCount).toEqual({ done: 1, total: 1 })
    expect(s.thread.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(s.streaming).toBe(false)
    expect(s.error).toBeNull()
    expect(s.regionImage).toBeNull()
    expect(s.regionIds).toEqual([])
    expect(saveThread).toHaveBeenCalledWith('/f', '/f/a.svg', s.thread)
    expect(startStream.mock.calls[0][0].messages.at(-1).images).toEqual([
      { mime: 'image/png', dataBase64: 'AAA' },
    ])
  })

  it('does not stream, checkpoint, or add thread noise when the provider has no API key', async () => {
    const startStream = vi.fn()
    const checkpoint = vi.fn().mockResolvedValue('cp')
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      keyStatus: vi.fn().mockResolvedValue({ anthropic: false, openai: false, gemini: false, ollama: false }),
      checkpoint,
      startStream,
      saveThread: vi.fn().mockResolvedValue(undefined),
    }
    useStore.setState({
      folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit',
      provider: 'anthropic', error: null,
    })

    await useStore.getState().sendPrompt('make it blue')

    const s = useStore.getState()
    expect(s.error).toBe('No API key set for Anthropic. Add one in Settings.')
    expect(startStream).not.toHaveBeenCalled()
    expect(checkpoint).not.toHaveBeenCalled()
    expect(s.thread).toEqual([]) // no user/assistant bubbles added
    expect(s.streaming).toBe(false)
  })

  it('surfaces a stream error without retrying and without a misleading edit-failure message', async () => {
    const startStream = vi.fn((_args, h) => { h.onError('Anthropic 401: invalid x-api-key'); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
      checkpoint: vi.fn().mockResolvedValue('cp'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      saveThread: vi.fn().mockResolvedValue(undefined),
      startStream,
    }
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', error: null })

    await useStore.getState().sendPrompt('make it blue')

    const s = useStore.getState()
    expect(startStream).toHaveBeenCalledTimes(1) // no retries for a provider error
    expect(s.error).toContain('Anthropic request failed')
    expect(s.thread.some((m) => m.content.includes('Could not apply'))).toBe(false)
    // Full provider error is captured in the message log and the drawer is opened.
    const errEntry = s.thread.find((m) => m.error)
    expect(errEntry?.content).toContain('Anthropic 401: invalid x-api-key')
    expect(s.threadOpen).toBe(true)
    expect(s.streaming).toBe(false)
  })

  it('does not resend a logged error entry to the provider as history', async () => {
    const startStream = vi.fn((_args, h) => { h.onChunk(editReply); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
      checkpoint: vi.fn().mockResolvedValue('cp'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      saveThread: vi.fn().mockResolvedValue(undefined),
      startStream,
    }
    // Seed a prior error entry in the thread, then send a new prompt.
    useStore.setState({
      folder: '/f', activePath: '/f/a.svg', source: svg, mode: 'edit', provider: 'anthropic', error: null,
      thread: [{ role: 'assistant', content: 'Anthropic request failed:\n...', error: true }],
    })

    await useStore.getState().sendPrompt('make it blue')

    const sent = startStream.mock.calls[0][0].messages as { content: string }[]
    expect(sent.some((m) => m.content.includes('request failed'))).toBe(false)
  })
})

describe('sendPrompt suggestedName', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>'
  const clipot = (startStream: unknown) => ({
    keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
    savePrefs: vi.fn().mockResolvedValue(undefined),
    checkpoint: vi.fn().mockResolvedValue('cp'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    saveThread: vi.fn().mockResolvedValue(undefined),
    startStream,
  })

  it('captures the filename from a named FILE block', async () => {
    const reply = '<<<FILE dog.svg\n' + svg + '\n>>>'
    const startStream = vi.fn((_a, h) => { h.onChunk(reply); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = clipot(startStream)
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', suggestedName: null })
    await useStore.getState().sendPrompt('make a dog')
    expect(useStore.getState().suggestedName).toBe('dog.svg')
  })

  it('leaves suggestedName null when the reply has no filename', async () => {
    const reply = 'Here you go\n```svg\n' + svg + '\n```'
    const startStream = vi.fn((_a, h) => { h.onChunk(reply); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = clipot(startStream)
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', suggestedName: 'stale.svg' })
    await useStore.getState().sendPrompt('make a dog')
    expect(useStore.getState().suggestedName).toBeNull()
  })
})

describe('sendPrompt fallback (loose SVG)', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>'
  const newSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle id="dog" r="5"/></svg>'

  const baseClipot = (startStream: unknown) => ({
    keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
    savePrefs: vi.fn().mockResolvedValue(undefined),
    checkpoint: vi.fn().mockResolvedValue('cp'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    saveThread: vi.fn().mockResolvedValue(undefined),
    startStream,
  })

  it('applies an SVG the model returned in a fenced block (no edit/file markers)', async () => {
    const reply = 'Here is a simple illustration of a dog.\n```svg\n' + newSvg + '\n```'
    const startStream = vi.fn((_a, h) => { h.onChunk(reply); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = baseClipot(startStream)
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', error: null })

    await useStore.getState().sendPrompt('draw a dog')

    const s = useStore.getState()
    expect(s.source).toBe(newSvg)
    expect(s.editCount).toEqual({ done: 1, total: 1 })
    expect(startStream).toHaveBeenCalledTimes(1) // no retry needed
    expect(s.error).toBeNull()
  })

  it('surfaces an error (not a silent no-op) when the reply has no SVG', async () => {
    const startStream = vi.fn((_a, h) => { h.onChunk('I could not do that.'); h.onDone(); return vi.fn() })
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = baseClipot(startStream)
    useStore.setState({ folder: '/f', activePath: '/f/a.svg', source: svg, thread: [], mode: 'edit', provider: 'anthropic', error: null })

    await useStore.getState().sendPrompt('draw a dog')

    const s = useStore.getState()
    expect(s.source).toBe(svg) // unchanged
    expect(startStream).toHaveBeenCalledTimes(3) // 1 + 2 retries
    expect(s.thread.some((m) => m.error)).toBe(true)
    expect(s.error).toContain('applicable')
  })
})

describe('autosave debounce and undo race', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>'
  const editReply = '<<<EDIT\nSEARCH:\n<rect id="clipot-1"/>\nREPLACE:\n<rect id="clipot-1" fill="blue"/>\n>>>'

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // sendPrompt awaits checkpoint before starting the stream; flush microtasks to reach onChunk.
  const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

  // Streams the edit synchronously but defers onDone, leaving the 300ms autosave timer armed
  // and sendPrompt() pending (so the trailing flush has not run yet).
  function setupDeferredStream() {
    const writeFile = vi.fn().mockResolvedValue(undefined)
    let done: () => void = () => {}
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      keyStatus: vi.fn().mockResolvedValue({ anthropic: true, openai: true, gemini: true, ollama: true }),
      savePrefs: vi.fn().mockResolvedValue(undefined),
      checkpoint: vi.fn().mockResolvedValue('cp'),
      writeFile,
      saveThread: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(svg),
      loadThread: vi.fn().mockResolvedValue([]),
      startStream: vi.fn((_args, h: { onChunk: (t: string) => void; onDone: () => void }) => {
        h.onChunk(editReply)
        done = h.onDone
        return vi.fn()
      }),
    }
    return { writeFile, finish: () => done() }
  }

  it('schedules a debounced write after a streamed edit that fires at 300ms with the edited source', async () => {
    const { writeFile, finish } = setupDeferredStream()
    useStore.setState({ folder: '/f' })
    await useStore.getState().openFile('/f/a.svg')

    const p = useStore.getState().sendPrompt('make it blue')
    await tick()
    expect(useStore.getState().source).toContain('fill="blue"')
    expect(writeFile).not.toHaveBeenCalled() // debounce armed, not yet fired

    vi.advanceTimersByTime(300)
    expect(writeFile).toHaveBeenCalledWith('/f/a.svg', expect.stringContaining('fill="blue"'))

    finish()
    await p
  })

  it('RACE: undo cancels the pending debounced autosave so the stale edit never overwrites', async () => {
    const { writeFile, finish } = setupDeferredStream()
    useStore.setState({ folder: '/f' })
    await useStore.getState().openFile('/f/a.svg')

    const p = useStore.getState().sendPrompt('make it blue')
    await tick()
    expect(useStore.getState().source).toContain('fill="blue"')
    expect(writeFile).not.toHaveBeenCalled() // edited autosave is pending

    // User clicks Undo while the edited write is still queued.
    useStore.getState().undo()
    expect(useStore.getState().source).toBe(svg)
    // Undo performed a direct write of the reverted source.
    expect(writeFile).toHaveBeenCalledWith('/f/a.svg', svg)

    writeFile.mockClear()
    // The stale debounced write must NOT fire after cancel().
    vi.advanceTimersByTime(1000)
    for (const call of writeFile.mock.calls) {
      expect(call[1]).not.toContain('fill="blue"')
    }

    finish()
    await p
  })
})

describe('pathExists', () => {
  const tree: TreeNode = {
    name: 'root', path: '/root', kind: 'dir',
    children: [
      { name: 'a.svg', path: '/root/a.svg', kind: 'file' },
      { name: 'sub', path: '/root/sub', kind: 'dir', children: [{ name: 'b.svg', path: '/root/sub/b.svg', kind: 'file' }] },
    ],
  }
  it('finds the root itself', () => {
    expect(pathExists(tree, '/root')).toBe(true)
  })
  it('finds a nested file at any depth', () => {
    expect(pathExists(tree, '/root/sub/b.svg')).toBe(true)
  })
  it('returns false for a path no longer in the tree', () => {
    expect(pathExists(tree, '/root/gone.svg')).toBe(false)
  })
  it('returns false for a null tree', () => {
    expect(pathExists(null, '/root/a.svg')).toBe(false)
  })
})

describe('init (session restore)', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="clipot-1"/></svg>'
  const tree = { name: 'f', path: '/f', kind: 'dir', children: [{ name: 'a.svg', path: '/f/a.svg', kind: 'file' }] }

  beforeEach(() => {
    useStore.setState({
      provider: 'anthropic', model: 'claude-sonnet-5',
      folder: null, tree: null, activePath: null, source: '', rules: '', thread: [],
    })
  })

  it('restores provider/model and reopens the last folder + active file', async () => {
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      loadPrefs: vi.fn().mockResolvedValue({ provider: 'gemini', model: 'gemini-2.5-flash', folder: '/f', activePath: '/f/a.svg' }),
      watchFolder: vi.fn().mockResolvedValue(undefined),
      readTree: vi.fn().mockResolvedValue(tree),
      loadRules: vi.fn().mockResolvedValue('my rules'),
      readFile: vi.fn().mockResolvedValue(svg),
      loadThread: vi.fn().mockResolvedValue([]),
      onTreeChanged: vi.fn(() => () => {}),
      savePrefs: vi.fn().mockResolvedValue(undefined),
    }

    await useStore.getState().init()

    const s = useStore.getState()
    expect(s.provider).toBe('gemini')
    expect(s.model).toBe('gemini-2.5-flash')
    expect(s.folder).toBe('/f')
    expect(s.rules).toBe('my rules')
    expect(s.activePath).toBe('/f/a.svg')
    expect(s.source).toBe(svg)
  })

  it('reopens the folder but not a saved active file that no longer exists', async () => {
    const readFile = vi.fn()
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      loadPrefs: vi.fn().mockResolvedValue({ provider: 'openai', model: 'gpt-5.2', folder: '/f', activePath: '/f/gone.svg' }),
      watchFolder: vi.fn().mockResolvedValue(undefined),
      readTree: vi.fn().mockResolvedValue({ name: 'f', path: '/f', kind: 'dir', children: [] }),
      loadRules: vi.fn().mockResolvedValue(''),
      onTreeChanged: vi.fn(() => () => {}),
      readFile,
    }

    await useStore.getState().init()

    const s = useStore.getState()
    expect(s.folder).toBe('/f')
    expect(s.activePath).toBeNull()
    expect(readFile).not.toHaveBeenCalled()
  })

  it('starts fresh (no crash) when loadPrefs is empty', async () => {
    ;(globalThis as unknown as { window: { clipot: unknown } }).window.clipot = {
      loadPrefs: vi.fn().mockResolvedValue({}),
    }
    await useStore.getState().init()
    expect(useStore.getState().folder).toBeNull()
  })
})
