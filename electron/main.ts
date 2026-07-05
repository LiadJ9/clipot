import { app, BrowserWindow, ipcMain, dialog, safeStorage, session } from 'electron'
import type { WebContents } from 'electron'
import { join, resolve, sep } from 'node:path'
import { readFile as readFileText } from 'node:fs/promises'
import chokidar from 'chokidar'
import { CH } from './shared/ipc'
import type { ThreadMessage } from './shared/ipc'
import * as files from './services/files'
import * as vault from './services/vault'
import * as history from './services/history'
import * as prefs from './services/prefs'
import { PROVIDERS as LLM_PROVIDERS } from './services/llm'
import { listOllamaModels } from './services/llm/ollama'
import type { LlmMessage } from './services/llm/types'
import type { ProviderId } from './services/vault'

const isDev = !!process.env.VITE_DEV_SERVER_URL
const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'gemini', 'ollama']
const ENV_VAR: Record<ProviderId, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  ollama: 'OLLAMA_HOST',
}
const OLLAMA_DEFAULT_HOST = 'http://localhost:11434'
const CURATED_MODELS: Partial<Record<ProviderId, string[]>> = {
  anthropic: ['claude-sonnet-5', 'claude-opus-4-8'],
  openai: ['gpt-5.2', 'gpt-5.1'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
}

let watcher: import('chokidar').FSWatcher | null = null
let keyStore: vault.KeyStore = {}
let nextRunId = 1
let openedFolder: string | null = null
const activeRuns = new Map<number, { aborted: boolean }>()

// Defense-in-depth: the renderer must not read/write/delete paths outside the
// opened folder. Every path-taking IPC handler resolves its args through this.
function assertInside(p: string): string {
  if (!openedFolder) throw new Error('No folder opened')
  const base = resolve(openedFolder)
  const target = resolve(p)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`Path escapes opened folder: ${p}`)
  }
  return target
}

function safeSend(sender: WebContents, channel: string, ...args: unknown[]) {
  if (!sender.isDestroyed()) sender.send(channel, ...args)
}

async function runStream(
  runId: number,
  args: { provider: ProviderId; model: string; messages: LlmMessage[] },
  sender: WebContents
) {
  const state = activeRuns.get(runId)
  try {
    // Test-only hook: stream a fixture file's contents instead of calling a real
    // provider. Strictly gated on CLIPOT_MOCK_LLM so production is unaffected.
    const mockLlmPath = process.env.CLIPOT_MOCK_LLM
    if (mockLlmPath) {
      const text = await readFileText(mockLlmPath, 'utf8')
      if (state?.aborted) return
      safeSend(sender, CH.llmChunk, runId, text)
      if (!state?.aborted) safeSend(sender, CH.llmDone, runId)
      return
    }
    const provider = LLM_PROVIDERS[args.provider]
    if (!provider) throw new Error(`Unknown provider: ${args.provider}`)
    const resolved = vault.resolveKey(args.provider, keyStore, process.env)
    if (args.provider !== 'ollama' && !resolved) throw new Error(`No API key configured for ${args.provider}`)
    const apiKey = args.provider === 'ollama' ? (resolved ?? OLLAMA_DEFAULT_HOST) : resolved!
    const messages = provider.supportsVision(args.model)
      ? args.messages
      : args.messages.map(({ images: _images, ...rest }) => rest)
    for await (const chunk of provider.stream({ model: args.model, messages, apiKey })) {
      if (state?.aborted) return
      safeSend(sender, CH.llmChunk, runId, chunk)
    }
    if (!state?.aborted) safeSend(sender, CH.llmDone, runId)
  } catch (err) {
    if (!state?.aborted) safeSend(sender, CH.llmError, runId, err instanceof Error ? err.message : String(err))
  } finally {
    activeRuns.delete(runId)
  }
}

const currentWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null

// Mark a folder as the opened root (for the assertInside guard) and watch it for
// changes. Shared by the folder picker and by restoring the last folder on boot.
function startWatching(folderPath: string) {
  openedFolder = resolve(folderPath)
  watcher?.close()
  watcher = chokidar.watch(folderPath, { ignoreInitial: true, ignored: /(^|[/\\])\.clipot/ })
  watcher.on('all', () => currentWindow()?.webContents.send(CH.treeChanged))
}

function loadVaultIntoEnv() {
  keyStore = vault.loadStore(app.getPath('userData'), safeStorage)
  for (const provider of PROVIDERS) {
    const envVar = ENV_VAR[provider]
    if (!process.env[envVar] && keyStore[provider]) process.env[envVar] = keyStore[provider]
  }
}

function registerIpc() {
  ipcMain.handle(CH.pickFolder, async () => {
    // Test-only hook: skip the native dialog and use this path directly.
    // Strictly gated on CLIPOT_TEST_FOLDER so production is unaffected.
    let folderPath: string
    if (process.env.CLIPOT_TEST_FOLDER) {
      folderPath = process.env.CLIPOT_TEST_FOLDER
    } else {
      const win = currentWindow()
      if (!win) return null
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      if (r.canceled || !r.filePaths[0]) return null
      folderPath = r.filePaths[0]
    }
    startWatching(folderPath)
    return folderPath
  })
  ipcMain.handle(CH.watchFolder, (_e, p: string) => startWatching(p))
  ipcMain.handle(CH.loadPrefs, () => prefs.loadPrefs(app.getPath('userData')))
  ipcMain.handle(CH.savePrefs, (_e, p: prefs.Prefs) => prefs.savePrefs(app.getPath('userData'), p))
  ipcMain.handle(CH.readTree, (_e, root: string) => { assertInside(root); return files.readTree(root) })
  ipcMain.handle(CH.readFile, (_e, p: string) => { assertInside(p); return files.readFile(p) })
  ipcMain.handle(CH.writeFile, (_e, p: string, c: string) => { assertInside(p); return files.writeFileAtomic(p, c) })
  ipcMain.handle(CH.createFile, (_e, p: string, c: string) => { assertInside(p); return files.createFile(p, c) })
  ipcMain.handle(CH.createDir, (_e, p: string) => { assertInside(p); return files.createDir(p) })
  ipcMain.handle(CH.rename, (_e, from: string, to: string) => { assertInside(from); assertInside(to); return files.rename(from, to) })
  ipcMain.handle(CH.move, (_e, from: string, dir: string) => { assertInside(from); assertInside(dir); return files.move(from, dir) })
  ipcMain.handle(CH.remove, (_e, p: string) => {
    const target = assertInside(p)
    if (target === resolve(openedFolder!)) throw new Error('Refusing to delete the opened root folder')
    return files.remove(p)
  })
  ipcMain.handle(CH.duplicate, (_e, p: string) => { assertInside(p); return files.duplicateFile(p) })
  ipcMain.handle(CH.keyStatus, () => {
    const status = {} as Record<ProviderId, boolean>
    for (const provider of PROVIDERS) status[provider] = vault.resolveKey(provider, keyStore, process.env) !== null
    return status
  })
  ipcMain.handle(CH.setKey, (_e, provider: ProviderId, value: string) => {
    if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider: ${provider}`)
    const next = { ...keyStore, [provider]: value }
    vault.saveStore(app.getPath('userData'), safeStorage, next)
    keyStore = next
  })
  ipcMain.handle(CH.checkpoint, (_e, folder: string, filePath: string, source: string, promptSlug: string) => {
    assertInside(folder); assertInside(filePath)
    return history.checkpoint(folder, filePath, source, promptSlug)
  })
  ipcMain.handle(CH.listCheckpoints, (_e, folder: string, filePath: string) => {
    assertInside(folder); assertInside(filePath)
    return history.listCheckpoints(folder, filePath)
  })
  ipcMain.handle(CH.loadThread, (_e, folder: string, filePath: string) => {
    assertInside(folder); assertInside(filePath)
    return history.loadThread(folder, filePath)
  })
  ipcMain.handle(CH.saveThread, (_e, folder: string, filePath: string, messages: ThreadMessage[]) => {
    assertInside(folder); assertInside(filePath)
    return history.saveThread(folder, filePath, messages)
  })
  ipcMain.handle(CH.loadRules, (_e, folder: string) => { assertInside(folder); return history.loadRules(folder) })
  ipcMain.handle(CH.saveRules, (_e, folder: string, content: string) => { assertInside(folder); return history.saveRules(folder, content) })
  ipcMain.handle(CH.llmStart, (e, args: { provider: ProviderId; model: string; messages: LlmMessage[] }) => {
    const runId = nextRunId++
    activeRuns.set(runId, { aborted: false })
    void runStream(runId, args, e.sender)
    return runId
  })
  ipcMain.on(CH.llmStop, (_e, runId: number) => {
    const state = activeRuns.get(runId)
    if (state) state.aborted = true
  })
  ipcMain.handle(CH.listModels, async (_e, provider: ProviderId) => {
    if (provider === 'ollama') {
      const host = vault.resolveKey('ollama', keyStore, process.env) ?? OLLAMA_DEFAULT_HOST
      try {
        return await listOllamaModels(host)
      } catch {
        return []
      }
    }
    return CURATED_MODELS[provider] ?? []
  })
  ipcMain.on(CH.winMinimize, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on(CH.winToggleMaximize, (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on(CH.winClose, (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle(CH.winIsMaximized, (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: '#0e0b08',
    icon: join(app.getAppPath(), 'assets/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  // Lock down navigation: block window.open and any in-page navigation. The
  // initial programmatic loadURL/loadFile below does not trigger will-navigate.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  // Scale the whole UI up 20%; re-applied after every (re)load, incl. dev HMR.
  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(1.2))
  win.on('maximize', () => safeSend(win.webContents, CH.winMaximizedChanged, true))
  win.on('unmaximize', () => safeSend(win.webContents, CH.winMaximizedChanged, false))
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  else win.loadFile(join(__dirname, '../dist/index.html'))
}

function applyCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*",
        ],
      },
    })
  })
}

app.whenReady().then(() => {
  loadVaultIntoEnv()
  // CSP is a production hardening control. In dev, Vite serves an inline
  // react-refresh preamble that script-src 'self' would block, breaking the
  // renderer; the dev server is a trusted local origin, so skip CSP there.
  if (!isDev) applyCsp()
  registerIpc()
  createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
