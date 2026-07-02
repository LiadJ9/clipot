import { app, BrowserWindow, ipcMain, dialog, safeStorage } from 'electron'
import type { WebContents } from 'electron'
import { join } from 'node:path'
import chokidar from 'chokidar'
import { CH } from './shared/ipc'
import type { ThreadMessage } from './shared/ipc'
import * as files from './services/files'
import * as vault from './services/vault'
import * as history from './services/history'
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
  gemini: ['gemini-3.0-pro', 'gemini-2.5-flash'],
}

let watcher: import('chokidar').FSWatcher | null = null
let keyStore: vault.KeyStore = {}
let nextRunId = 1
const activeRuns = new Map<number, { aborted: boolean }>()

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

function loadVaultIntoEnv() {
  keyStore = vault.loadStore(app.getPath('userData'), safeStorage)
  for (const provider of PROVIDERS) {
    const envVar = ENV_VAR[provider]
    if (!process.env[envVar] && keyStore[provider]) process.env[envVar] = keyStore[provider]
  }
}

function registerIpc() {
  ipcMain.handle(CH.pickFolder, async () => {
    const win = currentWindow()
    if (!win) return null
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths[0]) return null
    watcher?.close()
    watcher = chokidar.watch(r.filePaths[0], { ignoreInitial: true, ignored: /(^|[/\\])\.clipot/ })
    watcher.on('all', () => currentWindow()?.webContents.send(CH.treeChanged))
    return r.filePaths[0]
  })
  ipcMain.handle(CH.readTree, (_e, root: string) => files.readTree(root))
  ipcMain.handle(CH.readFile, (_e, p: string) => files.readFile(p))
  ipcMain.handle(CH.writeFile, (_e, p: string, c: string) => files.writeFileAtomic(p, c))
  ipcMain.handle(CH.createFile, (_e, p: string, c: string) => files.createFile(p, c))
  ipcMain.handle(CH.createDir, (_e, p: string) => files.createDir(p))
  ipcMain.handle(CH.rename, (_e, from: string, to: string) => files.rename(from, to))
  ipcMain.handle(CH.move, (_e, from: string, dir: string) => files.move(from, dir))
  ipcMain.handle(CH.remove, (_e, p: string) => files.remove(p))
  ipcMain.handle(CH.duplicate, (_e, p: string) => files.duplicateFile(p))
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
  ipcMain.handle(CH.checkpoint, (_e, folder: string, filePath: string, source: string, promptSlug: string) =>
    history.checkpoint(folder, filePath, source, promptSlug))
  ipcMain.handle(CH.listCheckpoints, (_e, folder: string, filePath: string) => history.listCheckpoints(folder, filePath))
  ipcMain.handle(CH.loadThread, (_e, folder: string, filePath: string) => history.loadThread(folder, filePath))
  ipcMain.handle(CH.saveThread, (_e, folder: string, filePath: string, messages: ThreadMessage[]) =>
    history.saveThread(folder, filePath, messages))
  ipcMain.handle(CH.loadRules, (_e, folder: string) => history.loadRules(folder))
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
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0e0b08',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  else win.loadFile(join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  loadVaultIntoEnv()
  registerIpc()
  createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
